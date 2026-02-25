import React, { useState } from "react";
import "./Generate.css";
import GitHubConnect from "./GitHubConnect.jsx";

function defaultStartDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export default function Generate() {
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // GitHub import state
  const [ghUser, setGhUser] = useState(null);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState(null);

  const handleImport = async () => {
    setImporting(true);
    setImportNote(null);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startDate, end: endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setEvidenceText(JSON.stringify(data, null, 2));
      setImportNote(`Imported ${data.contributions?.length ?? 0} contribution(s). Review below and click Generate.`);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleGenerate = async () => {
    let evidence;
    try {
      evidence = JSON.parse(evidenceText);
    } catch {
      setError("Invalid JSON. Paste or upload a valid evidence.json.");
      return;
    }
    if (!evidence.timeframe?.start_date || !evidence.timeframe?.end_date || !Array.isArray(evidence.contributions)) {
      setError("Evidence must have timeframe.start_date, timeframe.end_date, and contributions array.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evidence),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setResult(data);
    } catch (e) {
      setError(e.message || "Pipeline failed. Is OPENAI_API_KEY set?");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setEvidenceText(r.result); setError(null); };
    r.readAsText(file);
  };

  const loadSample = async () => {
    try {
      const res = await fetch("/sample-evidence.json");
      const data = await res.json();
      setEvidenceText(JSON.stringify(data, null, 2));
      setError(null);
    } catch {
      setError("Could not load sample.");
    }
  };

  return (
    <div className="generate">
      <header className="generate-header">
        <a href="/" className="generate-logo">
          <span className="generate-logo-icon">⟡</span>
          AnnualReview.dev
        </a>
        <a href="/" className="generate-back">← Back</a>
      </header>

      <main className="generate-main">
        <h1 className="generate-title">Generate review</h1>

        {/* ── Step 1: Connect GitHub ── */}
        <section className="generate-step">
          <h2 className="generate-step-title">Step 1 — Connect GitHub</h2>
          <GitHubConnect
            onConnected={(user) => setGhUser(user)}
            onDisconnected={() => { setGhUser(null); setImportNote(null); }}
          />
        </section>

        {/* ── Step 2: Pick timeframe and import ── */}
        {ghUser && (
          <section className="generate-step">
            <h2 className="generate-step-title">Step 2 — Import activity</h2>
            <div className="generate-timeframe">
              <label className="generate-date-label">
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="generate-date-input"
                />
              </label>
              <label className="generate-date-label">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="generate-date-input"
                />
              </label>
              <button
                type="button"
                className="generate-import-btn"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? "Importing…" : "Import activity"}
              </button>
            </div>
            {importNote && <p className="generate-import-note">{importNote}</p>}
          </section>
        )}

        {/* ── Step 3: Generate (or manual paste) ── */}
        <section className="generate-step">
          <h2 className="generate-step-title">
            {ghUser ? "Step 3 — Generate" : "Or paste evidence JSON manually"}
          </h2>
          {!ghUser && (
            <p className="generate-lead">
              Paste your evidence JSON below (or upload a file). It must include <code>timeframe</code> and <code>contributions</code>.
            </p>
          )}

          <div className="generate-input-row">
            <label className="generate-file-label">
              Upload evidence.json
              <input type="file" accept=".json,application/json" onChange={handleFile} className="generate-file-input" />
            </label>
            <button type="button" className="generate-sample-btn" onClick={loadSample}>Try sample</button>
          </div>
          <textarea
            className="generate-textarea"
            placeholder='{"timeframe": {"start_date": "2025-01-01", "end_date": "2025-12-31"}, "contributions": [...]}'
            value={evidenceText}
            onChange={(e) => { setEvidenceText(e.target.value); setError(null); }}
            rows={8}
          />

          {error && <p className="generate-error">{error}</p>}

          <button type="button" className="generate-btn" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate review"}
          </button>
        </section>

        {result && (
          <div className="generate-result">
            <h2>Your review</h2>
            <Section title="Themes" data={result.themes} />
            <Section title="Bullets" data={result.bullets} />
            <Section title="STAR stories" data={result.stories} />
            <Section title="Self-eval sections" data={result.self_eval} />
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, data }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <section className="generate-section">
      <div className="generate-section-head">
        <h3>{title}</h3>
        <button type="button" className="generate-copy" onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
      </div>
      <pre className="generate-pre">{text}</pre>
    </section>
  );
}
