export async function parseJsonResponse(res) {
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

const POLL_INITIAL_MS = 500;
const POLL_MAX_MS = 5000;
const POLL_BACKOFF_FACTOR = 1.5;

export async function pollJob(jobId, onProgress) {
  let delayMs = POLL_INITIAL_MS;
  for (;;) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const job = await parseJsonResponse(res);
    if (!res.ok) throw new Error(job.error || "Job not found");
    if (job.progress && typeof onProgress === "function") onProgress(job.progress);
    if (job.status === "done") return job.result;
    if (job.status === "failed") throw new Error(job.error || "Job failed");
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(Math.round(delayMs * POLL_BACKOFF_FACTOR), POLL_MAX_MS);
  }
}
