// Page: 1) Get GitHub data (OAuth or token or CLI), 2) Paste/upload evidence JSON, 3) Generate → themes, bullets, stories, self-eval.
import React, { useState, useEffect } from "react";
import "./Generate.css";
import { posthog } from "./posthog";

const GITHUB_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo&description=AnnualReview.dev";
const REPO_URL = "https://github.com/Skeyelab/annualreview.com";

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Server returned empty response." : `Request failed (${res.status}). Server may have timed out or crashed.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server: ${text.slice(0, 80)}…`);
  }
}

async function pollJob(jobId, onProgress) {
  for (;;) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const job = await parseJsonResponse(res);
    if (!res.ok) throw new Error(job.error || "Job not found");
    if (job.progress && typeof onProgress === "function") onProgress(job.progress);
    if (job.status === "done") return job.result;
    if (job.status === "failed") throw new Error(job.error || "Job failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function getDefaultDateRange() {
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  return { start: from.toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) };
}

export default function Generate() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [collectToken, setCollectToken] = useState("");
  const [collectStart, setCollectStart] = useState(() => getDefaultDateRange().start);
  const [collectEnd, setCollectEnd] = useState(() => getDefaultDateRange().end);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectProgress, setCollectProgress] = useState("");
  const [collectError, setCollectError] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not authenticated"))))
      .then((data) => setUser({ login: data.login, scope: data.scope }))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

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
          ? "Invalid JSON—looks truncated (e.g. missing contributions or closing brackets). Try “Upload evidence.json” instead of pasting, or paste the full file again."
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

  const handleFetchGitHub = async () => {
    if (!user && !collectToken.trim()) {
      setCollectError("Paste your GitHub token above.");
      return;
    }
    setCollectError(null);
    setCollectLoading(true);
    setCollectProgress("");
    posthog?.capture("collect_started", { method: user ? "session" : "token" });
    try {
      const body = user
        ? { start_date: collectStart, end_date: collectEnd }
        : { token: collectToken.trim(), start_date: collectStart, end_date: collectEnd };
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse(res);
      if (res.status === 202 && data.job_id) {
        const evidence = await pollJob(data.job_id, setCollectProgress);
        setEvidenceText(JSON.stringify(evidence, null, 2));
        setError(null);
        posthog?.capture("collect_completed");
      } else if (!res.ok) {
        throw new Error(data.error || "Fetch failed");
      } else {
        setEvidenceText(JSON.stringify(data, null, 2));
        setError(null);
        posthog?.capture("collect_completed");
      }
    } catch (e) {
      posthog?.capture("collect_failed", { error: e.message });
      setCollectError(e.message || "Could not fetch from GitHub.");
    } finally {
      setCollectLoading(false);
      setCollectProgress("");
    }
  };

  const handleLogout = () => {
    posthog?.capture("logout");
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => setUser(null));
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
                <div className="generate-collect-form">
                  <div className="generate-collect-dates">
                    <label className="generate-collect-label">
                      From <input type="date" value={collectStart} onChange={(e) => setCollectStart(e.target.value)} className="generate-collect-date" />
                    </label>
                    <label className="generate-collect-label">
                      To <input type="date" value={collectEnd} onChange={(e) => setCollectEnd(e.target.value)} className="generate-collect-date" />
                    </label>
                  </div>
                  {collectError && <p className="generate-error">{collectError}</p>}
                  {collectProgress && <p className="generate-progress">{collectProgress}</p>}
                  <button type="button" className="generate-collect-btn" onClick={handleFetchGitHub} disabled={collectLoading}>
                    {collectLoading ? "Fetching…" : "Fetch my data"}
                  </button>
                </div>
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
                  <div className="generate-collect-form">
                    <input
                      type="password"
                      placeholder="Paste your GitHub token (ghp_... or gho_...)"
                      value={collectToken}
                      onChange={(e) => { setCollectToken(e.target.value); setCollectError(null); }}
                      className="generate-collect-input"
                      autoComplete="off"
                    />
                    <div className="generate-collect-dates">
                      <label className="generate-collect-label">
                        From <input type="date" value={collectStart} onChange={(e) => setCollectStart(e.target.value)} className="generate-collect-date" />
                      </label>
                      <label className="generate-collect-label">
                        To <input type="date" value={collectEnd} onChange={(e) => setCollectEnd(e.target.value)} className="generate-collect-date" />
                      </label>
                    </div>
                    {collectError && <p className="generate-error">{collectError}</p>}
                    {collectProgress && <p className="generate-progress">{collectProgress}</p>}
                    <button type="button" className="generate-collect-btn" onClick={handleFetchGitHub} disabled={collectLoading}>
                      {collectLoading ? "Fetching…" : "Fetch my data"}
                    </button>
                  </div>
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
        <p className="generate-hint">On mobile, pasting long JSON can be cut off—use “Upload evidence.json” for large data.</p>

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
          </div>
        )}
      </main>
    </div>
  );
}

/** One pipeline output section: title, copy button, pretty-printed JSON. */
function ResultSection({ title, data }) {
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
