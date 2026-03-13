
const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const BASE = `${API}/api/journal`;

// Save a new journal entry
export async function createEntry(userId, ambience, text) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ambience, text }),
  });
  if (!res.ok) throw new Error("Failed to save entry.");
  return res.json();
}

// Fetch all entries for a user
export async function getEntries(userId) {
  const res = await fetch(`${BASE}/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch entries.");
  return res.json();
}

// Analyze emotion in a piece of text via LLM
export async function analyzeText(text) {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text}),
  });
  if (!res.ok) throw new Error("Failed to analyze text.");
  return res.json();
}

// Get insights for a user
export async function getInsights(userId) {
  const res = await fetch(`${BASE}/insights/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch insights.");
  return res.json();
}
