import React, { useState, useEffect } from "react";

/**
 * GitHubConnect: shows GitHub connection status and connect/disconnect UI.
 * On mount it checks /api/auth/me; on connect it redirects to /api/auth/start.
 *
 * @param {{ onConnected: (user: {login: string, avatar_url: string}) => void, onDisconnected: () => void }} props
 */
export default function GitHubConnect({ onConnected, onDisconnected }) {
  const [status, setStatus] = useState(null); // null = loading, object when resolved

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.connected) onConnected?.(data);
      })
      .catch(() => setStatus({ connected: false }));
  }, []);

  const disconnect = async () => {
    await fetch("/api/auth/disconnect", { method: "POST" });
    setStatus({ connected: false });
    onDisconnected?.();
  };

  if (status === null) {
    return <p className="gh-connect-loading">Checking GitHub connection…</p>;
  }

  if (status.connected) {
    return (
      <div className="gh-connect-status">
        {status.avatar_url && (
          <img src={status.avatar_url} alt="" className="gh-connect-avatar" />
        )}
        <span className="gh-connect-login">
          Connected as <strong>@{status.login}</strong>
        </span>
        <button type="button" className="gh-connect-disconnect" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="gh-connect-prompt">
      <p className="gh-connect-desc">
        Connect GitHub to import your PRs, reviews, and releases automatically.
      </p>
      <div className="gh-connect-actions">
        <a href="/api/auth/start" className="btn-gh-connect">
          <GitHubIcon />
          Connect GitHub (public repos)
        </a>
        <a href="/api/auth/start?scope=private" className="btn-gh-connect btn-gh-connect-outline">
          <GitHubIcon />
          Connect (include private repos)
        </a>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ marginRight: "0.4rem", flexShrink: 0 }}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
