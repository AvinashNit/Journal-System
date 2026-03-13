const express = require("express");
const router = express.Router();
const Journal = require("../models/Journal");


async function callLLM(text, retry = false) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log(" No GEMINI_API_KEY set — returning mock response.");
    return {
      emotion: "calm",
      keywords: ["nature", "peace", "reflection"],
      summary: "User experienced a peaceful and reflective moment during their nature session.",
    };
  }

  const prompt = `Analyze the emotion in this journal entry. Respond with ONLY a JSON object, no extra text.

Journal entry: "${text}"

Respond with exactly this structure:
{"emotion":"word","keywords":["word1","word2","word3"],"summary":"one sentence"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  let data;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,              
          responseMimeType: "application/json", 
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err}`);
    }

    data = await response.json();
  } catch (err) {
    if (!retry) {
      console.warn("[Gemini] Request failed, retrying once...", err.message);
      return callLLM(text, true);
    }
    throw err;
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log("[Gemini] Raw response:", raw);

  if (!raw) {
    if (!retry) {
      console.warn("[Gemini] Empty response, retrying once...");
      return callLLM(text, true);
    }
    throw new Error("Gemini returned an empty response after retry.");
  }

  return parseOrRepair(raw, text, retry);
}

async function parseOrRepair(raw, originalText, retry) {
  const clean = raw.replace(/```json|```/gi, "").trim();

  //  direct parse
  try {
    return validateAndNormalize(JSON.parse(clean));
  } catch (_) {}

  //  extract JSON substring
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      return validateAndNormalize(JSON.parse(clean.slice(start, end + 1)));
    } catch (_) {}
  }

  //  field-level regex extraction
  console.warn("[Gemini] JSON parse failed — attempting field extraction.");
  const extracted = extractFields(clean);
  if (extracted) {
    console.warn("[Gemini] Recovered via field extraction:", extracted);
    return extracted;
  }

  // retry once
  if (!retry) {
    console.warn("[Gemini] Could not parse response, retrying once...");
    return callLLM(originalText, true);
  }

  // safe default
  console.error("[Gemini] All parse attempts failed. Returning safe default.");
  return {
    emotion: "unknown",
    keywords: [],
    summary: "Unable to analyze the journal entry.",
    _error: true,
  };
}

function validateAndNormalize(obj) {
  if (typeof obj !== "object" || obj === null) throw new Error("Not an object");

  return {
    emotion:
      typeof obj.emotion === "string" && obj.emotion.trim()
        ? obj.emotion.trim().toLowerCase()
        : "unknown",

    keywords: Array.isArray(obj.keywords)
      ? obj.keywords.filter((k) => typeof k === "string").slice(0, 5)
      : typeof obj.keywords === "string"
        ? obj.keywords.split(",").map((k) => k.trim())
        : [],

    summary:
      typeof obj.summary === "string" && obj.summary.trim()
        ? obj.summary.trim()
        : "No summary available.",
  };
}

function extractFields(text) {
  const emotion = text.match(/"emotion"\s*:\s*"([^"]+)"/)?.[1]?.trim();
  const summary = text.match(/"summary"\s*:\s*"([^"]+)"/)?.[1]?.trim();
  const keywordsMatch = text.match(/"keywords"\s*:\s*\[([^\]]*)\]/);
  const keywords = keywordsMatch
    ? keywordsMatch[1].match(/"([^"]+)"/g)?.map((k) => k.replace(/"/g, "")) ?? []
    : [];

  if (!emotion && !summary) return null;

  return {
    emotion: emotion?.toLowerCase() ?? "unknown",
    keywords,
    summary: summary ?? "No summary available.",
  };
}

// route 1 — post /api/journal
// Save a new journal entry

router.post("/", async (req, res) => {
  try {
    const { userId, ambience, text } = req.body;

    // basic validation
    if (!userId || !ambience || !text) {
      return res
        .status(400)
        .json({ error: "userId, ambience, and text are all required." });
    }

    const entry = new Journal({ userId, ambience, text });
    await entry.save();

    res.status(201).json(entry);
  } catch (err) {
    console.error("POST /api/journal error:", err.message);
    res.status(500).json({ error: "Failed to save journal entry." });
  }
});

// route 2 — get /api/journal/:userId

router.get("/:userId", async (req, res) => {
  try {
    const entries = await Journal.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    res.json(entries);
  } catch (err) {
    console.error("GET /api/journal/:userId error:", err.message);
    res.status(500).json({ error: "Failed to fetch journal entries." });
  }
});

// Send text to LLM and return emotion analysis
router.post("/analyze", async (req, res) => {
  console.log(req.body)
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required." });
    }

    const result = await callLLM(text);
    res.json(result);
  } catch (err) {
    console.error("POST /api/journal/analyze error:", err.message);
    res.status(500).json({ error: "Failed to analyze text. " + err.message });
  }
});

// route 4 — get /api/journal/insights/:userId
router.get("/insights/:userId", async (req, res) => {
  try {
    const entries = await Journal.find({ userId: req.params.userId });

    // Nothing stored yet
    if (entries.length === 0) {
      return res.json({
        totalEntries: 0,
        topEmotion: null,
        mostUsedAmbience: null,
        recentKeywords: [],
      });
    }

    // most used ambience 
    const ambienceCount = {};
    for (const entry of entries) {
      ambienceCount[entry.ambience] = (ambienceCount[entry.ambience] || 0) + 1;
    }
    const mostUsedAmbience = Object.entries(ambienceCount).sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    // top emotion (keyword-matching heuristic) 
    const emotionWords = {
      calm: ["calm", "peaceful", "relaxed", "serene", "quiet", "still", "tranquil"],
      happy: ["happy", "joy", "joyful", "excited", "wonderful", "great", "cheerful"],
      sad: ["sad", "lonely", "down", "melancholy", "unhappy", "gloomy", "upset"],
      anxious: ["anxious", "worried", "nervous", "stressed", "uneasy", "tense"],
      grateful: ["grateful", "thankful", "blessed", "appreciate", "gratitude"],
      energized: ["energized", "alive", "vibrant", "strong", "refreshed", "invigorated"],
      focused: ["focused", "clear", "sharp", "productive", "present", "mindful"],
    };

    const emotionScore = {};
    for (const entry of entries) {
      const lower = entry.text.toLowerCase();
      for (const [emotion, words] of Object.entries(emotionWords)) {
        for (const word of words) {
          if (lower.includes(word)) {
            emotionScore[emotion] = (emotionScore[emotion] || 0) + 1;
          }
        }
      }
    }

    const topEmotion =
      Object.keys(emotionScore).length > 0
        ? Object.entries(emotionScore).sort((a, b) => b[1] - a[1])[0][0]
        : "reflective"; // sensible default

    // recent keywords (simple word-frequency on last 5 entries)
    const stopWords = new Set([
      "i", "a", "the", "and", "or", "to", "in", "of", "it", "was", "is",
      "my", "me", "that", "this", "with", "felt", "feel", "today", "after",
      "very", "so", "but", "had", "have", "been", "an", "at", "on", "for",
      "just", "not", "when", "from", "how", "did", "do", "also", "more",
    ]);

    const wordCount = {};
    const recentEntries = entries.slice(0, 5);

    for (const entry of recentEntries) {
      const words = entry.text
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .split(/\s+/);

      for (const word of words) {
        if (word.length > 3 && !stopWords.has(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      }
    }

    const recentKeywords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    res.json({
      totalEntries: entries.length,
      topEmotion,
      mostUsedAmbience,
      recentKeywords,
    });
  } catch (err) {
    console.error("GET /api/journal/insights/:userId error:", err.message);
    res.status(500).json({ error: "Failed to compute insights." });
  }
});

module.exports = router;
