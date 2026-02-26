/**
 * Generate API: POST / - validate evidence, create job, run pipeline in background.
 * Returns Connect-style middleware (req, res, next).
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { ValidationResult } from "../../lib/validate-evidence.js";
import type { Evidence } from "../../types/evidence.js";
import type { PipelineResult } from "../../lib/run-pipeline.js";

export interface GenerateRoutesOptions {
  readJsonBody: (req: IncomingMessage) => Promise<object>;
  respondJson: (res: ServerResponse, status: number, data: object) => void;
  validateEvidence: (evidence: unknown) => ValidationResult;
  createJob: (type: string) => string;
  runInBackground: (
    jobId: string,
    fn: (report: (data: { progress?: string }) => void) => void | Promise<void>
  ) => void;
  runPipeline: (
    evidence: Evidence,
    opts: { onProgress: (data: { stepIndex: number; total: number; label: string }) => void }
  ) => Promise<PipelineResult>;
}

type Next = () => void;

export function generateRoutes(options: GenerateRoutesOptions) {
  const {
    readJsonBody,
    respondJson,
    validateEvidence,
    createJob,
    runInBackground,
    runPipeline,
  } = options;

  return async function generateMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: Next
  ): Promise<void> {
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
                .map((e) => `${e.instancePath ?? "evidence"} ${e.message}`)
                .join("; ")
            : "Evidence must have timeframe (start_date, end_date) and contributions array.";
        respondJson(res, 400, { error: "Invalid evidence", details: msg });
        return;
      }
      const jobId = createJob("generate");
      runInBackground(jobId, (report) =>
        runPipeline(evidence as Evidence, {
          onProgress: ({ stepIndex, total, label }) =>
            report({ progress: `${stepIndex}/${total} ${label}` }),
        })
      );
      respondJson(res, 202, { job_id: jobId });
    } catch (e) {
      const err = e as Error;
      respondJson(res, 500, { error: err.message || "Pipeline failed" });
    }
  };
}
