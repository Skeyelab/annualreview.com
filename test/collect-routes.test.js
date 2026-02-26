import { describe, it, expect, vi } from "vitest";
import { collectRoutes } from "../server/routes/collect.ts";

describe("collectRoutes", () => {
  it("enqueues collect via runInBackground and returns 202", async () => {
    const collectAndNormalize = vi.fn().mockResolvedValue({ contributions: [] });
    const respondJson = vi.fn();
    const runInBackground = vi.fn((jobId, fn) => {
      fn();
      return undefined;
    });

    const handler = collectRoutes({
      readJsonBody: vi.fn().mockResolvedValue({
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        token: "ghp_test",
      }),
      respondJson,
      DATE_YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
      getSessionIdFromRequest: vi.fn().mockReturnValue(null),
      getSession: vi.fn(),
      createJob: vi.fn().mockReturnValue("job_1"),
      runInBackground,
      collectAndNormalize,
    });

    await handler({ method: "POST" }, {}, vi.fn());

    expect(runInBackground).toHaveBeenCalledTimes(1);
    expect(respondJson).toHaveBeenCalledWith({}, 202, { job_id: "job_1" });
    expect(collectAndNormalize).toHaveBeenCalledWith({
      token: "ghp_test",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    });
  });
});
