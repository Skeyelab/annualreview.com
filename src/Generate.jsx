// Page: 1) Get GitHub data (OAuth or token or CLI), 2) Paste/upload evidence JSON, 3) Generate → themes, bullets, stories, self-eval.
import React, { useState, useEffect, useCallback } from "react";
import "./Generate.css";
import { generateMarkdown } from "../lib/generate-markdown.js";
import { posthog } from "./posthog";
import { parseJsonResponse, pollJob } from "./api.js";
import { useAuth } from "./hooks/useAuth.js";
import { useGitHubCollect } from "./hooks/useGitHubCollect.js";
import CollectForm from "./CollectForm.jsx";
import ResultSection from "./ResultSection.jsx";

const GITHUB_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo&description=AnnualReview.dev";
const REPO_URL = "https://github.com/Skeyelab/annualreview.com";

export default function Generate() {
  const { user, authChecked, logout } = useAuth();
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onEvidenceReceived = useCallback((text) => {
    setEvidenceText(text);
    setError(null);
  }, []);

  const {
    collectStart,
    setCollectStart,
    collectEnd,
    setCollectEnd,
    collectToken,
    setCollectToken,
    collectLoading,
    collectError,
    setCollectError,
    collectProgress,
    handleFetchGitHub,
  } = useGitHubCollect({ onEvidenceReceived });

  useEffect(() => {
    if (!user) return;
    fetch("/api/jobs", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const job = data.latest;
        if (job?.status === "done" && job.result) {
          setEvidenceText(JSON.stringify(job.result, null, 2));
          setError(null);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleGenerate = async () => {
    let evidence;
    try {
      evidence = JSON.parse(evidenceText);
    } catch {
      const looksTruncated =
        /[\{\[,]\s*$/.test(evidenceText.trim()) || !evidenceText.includes('"contributions"');
      setError(
        looksTruncated
          ? "Invalid JSON—looks truncated (e.g. missing contributions or closing brackets). Try \"Upload evidence.json\" instead of pasting, or paste the full file again."
          : "Invalid JSON. Paste or upload a valid evidence.json."
      );
      return;
    }
    if (!evidence.timeframe?.start_date || !evidence.timeframe?.end_date || !Array.isArray(evidence.contributions)) {
      setError("Evidence must have timeframe.start_date, timeframe.end_date, and contributions array.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setProgress("");
    posthog?.capture("review_generate_started");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evidence),
      });
      const data = await parseJsonResponse(res);
      if (res.status === 202 && data.job_id) {
        const out = await pollJob(data.job_id, setProgress);
        setResult(out);
        posthog?.capture("review_generate_completed");
      } else if (!res.ok) {
        throw new Error(data.error || "Generate failed");
      } else {
        setResult(data);
        posthog?.capture("review_generate_completed");
      }
    } catch (e) {
      posthog?.capture("review_generate_failed", { error: e.message });
      setError(e.message || "Pipeline failed. Is OPENAI_API_KEY set?");
    } finally {
      setLoading(false);
      setProgress("");
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
      const data = await parseJsonResponse(res);
      setEvidenceText(JSON.stringify(data, null, 2));
      setError(null);
    } catch (e) {
      setError(e.message || "Could not load sample.");
    }
  };

  const handleLogout = () => {
    posthog?.capture("logout");
    logout();
  };

  const handleDownloadReport = () => {
    let timeframe;
    try {
      const ev = JSON.parse(evidenceText);
      timeframe = ev.timeframe;
    } catch {
      // no timeframe available
    }
    const md = generateMarkdown(result, { timeframe });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annual-review-report.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="generate">
      <header className="generate-header">
        <a href="/" className="generate-logo">
          <span className="generate-logo-icon">⟡</span>
          AnnualReview.dev
        </a>
        <div className="generate-header-actions">
          {authChecked && user && (
            <span className="generate-signed-in">
              Signed in as <strong>{user.login}</strong>
              <button type="button" className="generate-logout" onClick={handleLogout}>Log out</button>
            </span>
          )}
          <a href="/" className="generate-back">← Back</a>
        </div>
      </header>

      <main className="generate-main">
        <h1 className="generate-title">Generate review</h1>

        <section className="generate-get-data" aria-labelledby="get-data-heading">
          <h2 id="get-data-heading" className="generate-get-data-title">1. Get your GitHub data</h2>

          <div className="generate-get-data-options">
            {authChecked && user ? (
              <div className="generate-option-card">
                <h3 className="generate-option-heading">Fetch your data</h3>
                <p className="generate-option-desc">Fetch your PRs and reviews for the date range.</p>
                <CollectForm
                  startDate={collectStart}
                  endDate={collectEnd}
                  onStartChange={setCollectStart}
                  onEndChange={setCollectEnd}
                  error={collectError}
                  progress={collectProgress}
                  loading={collectLoading}
                  onSubmit={() => handleFetchGitHub(user)}
                  submitLabel="Fetch my data"
                />
              </div>
            ) : (
              <>
                <div className="generate-option-card">
                  <h3 className="generate-option-heading">Sign in with GitHub</h3>
                  <p className="generate-option-desc">
                    We fetch your PRs and reviews for the date range. We never store your code.
                  </p>
                  <div className="generate-oauth-buttons">
                    <a href="/api/auth/github?scope=public" className="generate-oauth-btn" onClick={() => posthog?.capture("login_started", { scope: "public" })}>Connect (public repos only)</a>
                    <a href="/api/auth/github?scope=private" className="generate-oauth-btn generate-oauth-btn-private" onClick={() => posthog?.capture("login_started", { scope: "private" })}>Connect (include private repos)</a>
                  </div>
                  <p className="generate-option-desc generate-or">Or paste a Personal Access Token:</p>
                  <CollectForm
                    startDate={collectStart}
                    endDate={collectEnd}
                    onStartChange={setCollectStart}
                    onEndChange={setCollectEnd}
                    error={collectError}
                    progress={collectProgress}
                    loading={collectLoading}
                    onSubmit={() => handleFetchGitHub(null)}
                    submitLabel="Fetch my data"
                  >
                    <input
                      type="password"
                      placeholder="Paste your GitHub token (ghp_... or gho_...)"
                      value={collectToken}
                      onChange={(e) => { setCollectToken(e.target.value); setCollectError(null); }}
                      className="generate-collect-input"
                      autoComplete="off"
                    />
                  </CollectForm>
                </div>
              </>
            )}

            <div className="generate-option-card">
              <h3 className="generate-option-heading">Use the terminal</h3>
              <p className="generate-option-desc">
                Run two commands. Your token stays on your machine.
              </p>
              <ol className="generate-steps-list">
                <li>Create a token at <a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener noreferrer">github.com/settings/tokens</a> with <strong>repo</strong> scope.</li>
                <li>From this repo (<a href={REPO_URL} target="_blank" rel="noopener noreferrer">clone it</a>), run:
                  <pre className="generate-cmd">
{`GITHUB_TOKEN=ghp_your_token yarn collect --start ${collectStart} --end ${collectEnd} --output raw.json
yarn normalize --input raw.json --output evidence.json`}
                  </pre>
                </li>
                <li>Upload <code>evidence.json</code> below or paste its contents.</li>
              </ol>
            </div>
          </div>
        </section>

        <h2 className="generate-step-title">2. Paste or upload evidence</h2>
        <p className="generate-lead">
          Evidence JSON must include <code>timeframe</code> and <code>contributions</code>. After fetching above or from the CLI, paste or upload it here.
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
          spellCheck={false}
        />
        <p className="generate-hint">On mobile, pasting long JSON can be cut off—use &quot;Upload evidence.json&quot; for large data.</p>

        {error && <p className="generate-error">{error}</p>}
        {progress && <p className="generate-progress">{progress}</p>}

        <button type="button" className="generate-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating…" : "3. Generate review"}
        </button>

        {result && (
          <div className="generate-result">
            <h2>Your review</h2>
            <ResultSection title="Themes" data={result.themes} />
            <ResultSection title="Bullets" data={result.bullets} />
            <ResultSection title="STAR stories" data={result.stories} />
            <ResultSection title="Self-eval sections" data={result.self_eval} />
            <ReportSection result={result} evidenceText={evidenceText} onDownload={handleDownloadReport} />
          </div>
        )}
      </main>
    </div>
  );
}

/** Markdown report section: preview + download. */
function ReportSection({ result, evidenceText, onDownload }) {
  const [showPreview, setShowPreview] = useState(false);
  let timeframe;
  try {
    const ev = JSON.parse(evidenceText);
    timeframe = ev.timeframe;
  } catch {
    // no timeframe
  }
  const md = generateMarkdown(result, { timeframe });
  return (
    <section className="generate-section generate-report-section">
      <div className="generate-section-head">
        <h3>Markdown report</h3>
        <div className="generate-report-actions">
          <button
            type="button"
            className="generate-copy"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button
            type="button"
            className="generate-copy"
            onClick={() => navigator.clipboard.writeText(md)}
          >
            Copy
          </button>
          <button
            type="button"
            className="generate-download-btn"
            onClick={onDownload}
          >
            Download .md
          </button>
        </div>
      </div>
      {showPreview && <pre className="generate-pre generate-report-pre">{md}</pre>}
    </section>
  );
}
