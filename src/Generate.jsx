import React, { useState } from "react";
import "./Generate.css";

export default function Generate() {
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
      const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
      const res = await fetch(`${base}sample-evidence.json`);
      if (!res.ok) throw new Error(`Sample not found (${res.status})`);
      const data = await res.json();
      setEvidenceText(JSON.stringify(data, null, 2));
      setError(null);
    } catch (e) {
      setError(e.message || "Could not load sample.");
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
        <p className="generate-lead">
          Paste your evidence JSON below (or upload a file). It must include <code>timeframe</code> and <code>contributions</code>.
        </p>

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
