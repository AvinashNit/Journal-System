import { useState, useEffect } from "react";
import { createEntry, getEntries, analyzeText, getInsights } from "./api";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

  body {
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    background: #fff;
    color: #111;
    margin: 0;
    padding: 0;
  }

  .wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: 30px 20px;
  }

  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-bottom: 4px; }
  h3 { font-size: 15px; font-weight: 500; margin: 20px 0 8px; }

  input, textarea, select {
    width: 100%;
    padding: 8px 10px;
    font-size: 14px;
    font-family: inherit;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  textarea { resize: vertical; min-height: 110px; line-height: 1.5; }

  button {
    padding: 8px 16px;
    font-size: 14px;
    font-family: inherit;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  button:hover { background: #f5f5f5; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  p  { margin: 6px 0; line-height: 1.5; }

  .error  { color: #c0392b; font-size: 13px; }
  .muted  { color: #888; font-size: 13px; }
`;

export default function App() {
  const [userId, setUserId] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [ambience, setAmbience] = useState("forest");
  const [entryText, setEntryText] = useState("");
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loggedIn) return;
    loadEntries();
    loadInsights();
  }, [loggedIn]);

  function handleLogin() {
    if (!userId.trim()) { alert("please type a user id"); return; }
    setLoggedIn(true);
  }

  async function loadEntries() {
    try { setEntries(await getEntries(userId)); }
    catch { setError("cant load entries. is backend running?"); }
  }

  async function loadInsights() {
    try { setInsights(await getInsights(userId)); }
    catch { setError("cant load insights"); }
  }

  async function handleSave() {
    if (!entryText.trim()) { alert("write something first!"); return; }
    setSaving(true); setError("");
    try {
      await createEntry(userId, ambience, entryText);
      setEntryText(""); setAnalysis(null);
      await loadEntries(); await loadInsights();
    } catch { setError("save failed. check if backend is on"); }
    setSaving(false);
  }

  async function handleAnalyze() {
    if (!entryText.trim()) { alert("nothing to analyze"); return; }
    setAnalyzing(true); setAnalysis(null);
    try { setAnalysis(await analyzeText(entryText)); }
    catch { setError("analyze failed"); }
    setAnalyzing(false);
  }

  // login
  if (!loggedIn) {
    return (
      <>
        <style>{style}</style>
        <div className="wrap" style={{ maxWidth: 360, paddingTop: 80 }}>
          <h1>Nature journal</h1>
          <p className="muted" style={{ marginBottom: 20 }}>Enter your user id to continue</p>
          <input
            placeholder="user id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ marginBottom: 10 }}
          />
          <button onClick={handleLogin}>login</button>
        </div>
      </>
    );
  }

  //main
  return (
    <>
      <style>{style}</style>
      <div className="wrap">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Hi, {userId}</h2>
          <button onClick={() => { setLoggedIn(false); setEntries([]); setInsights(null); }}>
            logout
          </button>
        </div>

        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}

        <hr />

        
        <h3>write entry</h3>

        <select
          value={ambience}
          onChange={(e) => setAmbience(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          <option value="forest">forest</option>
          <option value="ocean">ocean</option>
          <option value="mountain">mountain</option>
        </select>

        <textarea
          placeholder="how did you feel today..."
          value={entryText}
          onChange={(e) => setEntryText(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "saving..." : "save"}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? "analyzing..." : "analyze emotion"}
          </button>
        </div>

        {analysis && (
          <div style={{ marginTop: 16, padding: "12px 14px", border: "1px solid #ddd", borderRadius: 4 }}>
            <p><b>emotion:</b> {analysis.emotion}</p>
            <p><b>keywords:</b> {analysis.keywords?.join(", ")}</p>
            <p><b>summary:</b> {analysis.summary}</p>
          </div>
        )}

        <hr />

        {/* insights */}
        <h3>Insights</h3>
        {!insights ? (
          <p className="muted">loading...</p>
        ) : insights.totalEntries === 0 ? (
          <p className="muted">no entries yet</p>
        ) : (
          <div style={{ padding: "12px 14px", background: "#f9f9f9", borderRadius: 4 }}>
            <p>Total entries: {insights.totalEntries}</p>
            <p>top emotion: {insights.topEmotion}</p>
            <p>most used ambience: {insights.mostUsedAmbience}</p>
            <p>recent keywords: {insights.recentKeywords.join(", ")}</p>
          </div>
        )}

        <button onClick={() => { loadEntries(); loadInsights(); }} style={{ marginTop: 10 }}>
          refresh
        </button>

        <hr />

        {/* entries */}
        <h3>Previous entries</h3>
        {entries.length === 0 ? (
          <p className="muted">nothing here yet</p>
        ) : (
          entries.map((e) => (
            <div key={e._id} style={{ marginBottom: 16 }}>
              <p className="muted">{e.ambience} — {new Date(e.createdAt).toLocaleString()}</p>
              <p>{e.text}</p>
            </div>
          ))
        )}

      </div>
    </>
  );
}