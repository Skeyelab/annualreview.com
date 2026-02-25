/**
 * Collect API: POST / - validate dates, get token from session or body, create job, run collect in background.
 * Returns Connect-style middleware (req, res, next).
 *
 * @param {{
 *   readJsonBody: (req: any) => Promise<object>,
 *   respondJson: (res: any, status: number, data: object) => void,
 *   DATE_YYYY_MM_DD: RegExp,
 *   getSessionIdFromRequest: (req: any) => string | null,
 *   getSession: (id: string) => { access_token?: string } | undefined,
 *   createJob: (type: string, sessionId?: string) => string,
 *   runInBackground: (jobId: string, fn: () => void | Promise<void>) => void,
 *   collectAndNormalize: (opts: { token: string, start_date: string, end_date: string }) => Promise<void>,
 * }} options
 */
export function collectRoutes(options) {
  const {
    readJsonBody,
    respondJson,
    DATE_YYYY_MM_DD,
    getSessionIdFromRequest,
    getSession,
    createJob,
    runInBackground,
    collectAndNormalize,
  } = options;

  return async function collectMiddleware(req, res, next) {
    if (req.method !== "POST") {
      next();
      return;
    }
    try {
      const body = await readJsonBody(req);
      const { start_date, end_date } = body;
      if (!DATE_YYYY_MM_DD.test(start_date) || !DATE_YYYY_MM_DD.test(end_date)) {
        respondJson(res, 400, {
          error: "start_date and end_date must be YYYY-MM-DD",
        });
        return;
      }
      const sessionId = getSessionIdFromRequest(req);
      const session = sessionId ? getSession(sessionId) : undefined;
      const token = session?.access_token ?? body.token;
      if (!token || typeof token !== "string") {
        respondJson(res, 401, {
          error: "token required (sign in with GitHub or send token in body)",
        });
        return;
      }
      const jobId = createJob("collect", sessionId || undefined);
      runInBackground(jobId, () =>
        collectAndNormalize({ token, start_date, end_date })
      );
      respondJson(res, 202, { job_id: jobId });
    } catch (e) {
      const status =
        (e.message || "").includes("401") || (e.message || "").includes("403")
          ? 401
          : 500;
      respondJson(res, status, { error: e.message || "Fetch failed" });
    }
  };
}
