/**
 * Generate API: POST / - validate evidence, create job, run pipeline in background.
 * Returns Connect-style middleware (req, res, next).
 *
 * @param {{
 *   readJsonBody: (req: any) => Promise<object>,
 *   respondJson: (res: any, status: number, data: object) => void,
 *   validateEvidence: (evidence: any) => { valid: boolean, errors?: Array<{ instancePath?: string, message?: string }> },
 *   createJob: (type: string) => string,
 *   runInBackground: (jobId: string, fn: (report: (data: any) => void) => void | Promise<void>) => void,
 *   runPipeline: (evidence: any, opts: { onProgress: (data: any) => void }) => Promise<void>,
 * }} options
 */
export function generateRoutes(options) {
  const {
    readJsonBody,
    respondJson,
    validateEvidence,
    createJob,
    runInBackground,
    runPipeline,
  } = options;

  return async function generateMiddleware(req, res, next) {
    if (req.method !== "POST") {
      next();
      return;
    }
    try {
      const evidence = await readJsonBody(req);
      const validation = validateEvidence(evidence);
      if (!validation.valid) {
        const msg =
          validation.errors?.length
            ? validation.errors
                .map((e) => `${e.instancePath || "evidence"} ${e.message}`)
                .join("; ")
            : "Evidence must have timeframe (start_date, end_date) and contributions array.";
        respondJson(res, 400, { error: "Invalid evidence", details: msg });
        return;
      }
      const jobId = createJob("generate");
      runInBackground(jobId, (report) =>
        runPipeline(evidence, {
          onProgress: ({ stepIndex, total, label }) =>
            report({ progress: `${stepIndex}/${total} ${label}` }),
        })
      );
      respondJson(res, 202, { job_id: jobId });
    } catch (e) {
      respondJson(res, 500, { error: e.message || "Pipeline failed" });
    }
  };
}
