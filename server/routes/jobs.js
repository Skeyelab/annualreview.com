/**
 * Jobs API: GET / (list latest), GET /:id (job by id).
 * Returns Connect-style middleware (req, res, next).
 *
 * @param {{
 *   getSessionIdFromRequest: (req: any) => string | null,
 *   getLatestJob: (sessionId: string) => any,
 *   getJob: (id: string) => any,
 *   respondJson: (res: any, status: number, data: object) => void,
 * }} options
 */
export function jobsRoutes(options) {
  const {
    getSessionIdFromRequest,
    getLatestJob,
    getJob,
    respondJson,
  } = options;

  return function jobsMiddleware(req, res, next) {
    if (req.method !== "GET") {
      next();
      return;
    }
    const path = (req.url?.split("?")[0] || "").replace(/^\/+/, "") || "";
    if (!path) {
      const sessionId = getSessionIdFromRequest(req);
      const latest = sessionId ? getLatestJob(sessionId) : null;
      respondJson(res, 200, latest ? { latest } : { latest: null });
      return;
    }
    const id = decodeURIComponent(path);
    const job = getJob(id);
    if (!job) {
      respondJson(res, 404, { error: "Job not found" });
      return;
    }
    respondJson(res, 200, job);
  };
}
