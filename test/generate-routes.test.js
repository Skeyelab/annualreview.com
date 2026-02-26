import { describe, it, expect, vi } from "vitest";
import { generateRoutes } from "../server/routes/generate.ts";

describe("generateRoutes", () => {
  it("enqueues pipeline via runInBackground and returns 202", async () => {
    const runPipeline = vi.fn().mockResolvedValue({
      themes: {},
      bullets: {},
      stories: {},
      self_eval: {},
    });
    const respondJson = vi.fn();
    const runInBackground = vi.fn((jobId, fn) => {
      fn(vi.fn());
      return undefined;
    });

    const handler = generateRoutes({
      readJsonBody: vi.fn().mockResolvedValue({
        timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
        contributions: [],
      }),
      respondJson,
      validateEvidence: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      createJob: vi.fn().mockReturnValue("job_2"),
      runInBackground,
      runPipeline,
    });

    await handler({ method: "POST" }, {}, vi.fn());

    expect(runInBackground).toHaveBeenCalledTimes(1);
    expect(respondJson).toHaveBeenCalledWith({}, 202, { job_id: "job_2" });
    expect(runPipeline).toHaveBeenCalledTimes(1);
  });
});
