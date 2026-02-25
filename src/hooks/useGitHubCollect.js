import { useState, useCallback } from "react";
import { parseJsonResponse, pollJob } from "../api.js";
import { posthog } from "../posthog.js";

function getDefaultDateRange() {
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  return { start: from.toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) };
}

export function useGitHubCollect({ onEvidenceReceived }) {
  const [collectStart, setCollectStart] = useState(() => getDefaultDateRange().start);
  const [collectEnd, setCollectEnd] = useState(() => getDefaultDateRange().end);
  const [collectToken, setCollectToken] = useState("");
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError] = useState(null);
  const [collectProgress, setCollectProgress] = useState("");

  const handleFetchGitHub = useCallback(
    async (user) => {
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
          onEvidenceReceived(JSON.stringify(evidence, null, 2));
          posthog?.capture("collect_completed");
        } else if (!res.ok) {
          throw new Error(data.error || "Fetch failed");
        } else {
          onEvidenceReceived(JSON.stringify(data, null, 2));
          posthog?.capture("collect_completed");
        }
      } catch (e) {
        posthog?.capture("collect_failed", { error: e.message });
        setCollectError(e.message || "Could not fetch from GitHub.");
      } finally {
        setCollectLoading(false);
        setCollectProgress("");
      }
    },
    [collectStart, collectEnd, collectToken, onEvidenceReceived]
  );

  return {
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
  };
}
