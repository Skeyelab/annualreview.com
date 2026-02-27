import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateRoutes } from "../server/routes/generate.ts";
import { clearCreditStore, awardCredits, getCredits } from "../lib/payment-store.ts";

function respondJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(data) { this._body = data; },
    _body: null,
    get body() { return JSON.parse(this._body || "{}"); },
  };
}

const validEvidence = {
  timeframe: { start_date: "2025-01-01", end_date: "2025-12-31" },
  contributions: [],
};

function makeOptions(overrides = {}) {
  const runPipeline = vi.fn().mockResolvedValue({ themes: {}, bullets: {}, stories: {}, self_eval: {} });
  const createJob = vi.fn().mockReturnValue("job-1");
  const runInBackground = vi.fn((jobId, fn) => fn(() => {}));
  return {
    readJsonBody: vi.fn().mockResolvedValue({ ...validEvidence }),
    respondJson,
    validateEvidence: (ev) => ({ valid: !!ev?.timeframe?.start_date }),
    createJob,
    runInBackground,
    runPipeline,
    getStripe: () => null,
    ...overrides,
  };
}

describe("generateRoutes – premium flag", () => {
  beforeEach(() => clearCreditStore());

  it("runs free pipeline when no stripe_session_id", async () => {
    const opts = makeOptions();
    const handler = generateRoutes(opts);
    const req = { method: "POST", url: "/" };
    const res = mockRes();
    await handler(req, res, () => {});
    expect(opts.createJob).toHaveBeenCalledWith("generate");
    expect(opts.runPipeline).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ premium: false })
    );
    expect(res.body).toMatchObject({ job_id: "job-1", premium: false });
    expect(res.body).not.toHaveProperty("credits_remaining");
  });

  it("returns 402 when stripe_session_id is provided but session not paid", async () => {
    const opts = makeOptions({
      readJsonBody: vi.fn().mockResolvedValue({
        ...validEvidence,
        _stripe_session_id: "cs_unpaid",
      }),
      getStripe: () => ({
        checkout: {
          sessions: {
            retrieve: vi.fn().mockResolvedValue({ payment_status: "unpaid", id: "cs_unpaid" }),
          },
        },
      }),
    });
    const handler = generateRoutes(opts);
    const req = { method: "POST", url: "/" };
    const res = mockRes();
    await handler(req, res, () => {});
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toMatch(/payment required/i);
    expect(opts.runPipeline).not.toHaveBeenCalled();
  });

  it("runs premium pipeline and deducts one credit when session has credits", async () => {
    awardCredits("cs_with_credits"); // awards CREDITS_PER_PURCHASE (default 5)
    const opts = makeOptions({
      readJsonBody: vi.fn().mockResolvedValue({
        ...validEvidence,
        _stripe_session_id: "cs_with_credits",
      }),
    });
    const handler = generateRoutes(opts);
    const req = { method: "POST", url: "/" };
    const res = mockRes();
    await handler(req, res, () => {});
    expect(opts.createJob).toHaveBeenCalledWith("generate-premium");
    expect(opts.runPipeline).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ premium: true })
    );
    expect(res.body).toMatchObject({ job_id: "job-1", premium: true });
    // One credit deducted from 5 → 4 remaining
    expect(res.body.credits_remaining).toBe(4);
    expect(getCredits("cs_with_credits")).toBe(4);
  });

  it("runs premium pipeline when stripe session is verified as paid via API (awards then deducts)", async () => {
    const mockStripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({ payment_status: "paid", id: "cs_stripe_paid" }),
        },
      },
    };
    const opts = makeOptions({
      readJsonBody: vi.fn().mockResolvedValue({
        ...validEvidence,
        _stripe_session_id: "cs_stripe_paid",
      }),
      getStripe: () => mockStripe,
    });
    const handler = generateRoutes(opts);
    const req = { method: "POST", url: "/" };
    const res = mockRes();
    await handler(req, res, () => {});
    expect(opts.createJob).toHaveBeenCalledWith("generate-premium");
    expect(opts.runPipeline).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ premium: true })
    );
    // 5 awarded, 1 deducted → 4 remaining
    expect(res.body.credits_remaining).toBe(4);
  });

  it("returns 402 when credits are exhausted", async () => {
    // Award and exhaust all credits
    awardCredits("cs_exhausted");
    for (let i = 0; i < 5; i++) {
      const opts = makeOptions({
        readJsonBody: vi.fn().mockResolvedValue({ ...validEvidence, _stripe_session_id: "cs_exhausted" }),
      });
      const res = mockRes();
      await generateRoutes(opts)({ method: "POST", url: "/" }, res, () => {});
    }
    // Now out of credits — next call should 402
    const opts = makeOptions({
      readJsonBody: vi.fn().mockResolvedValue({ ...validEvidence, _stripe_session_id: "cs_exhausted" }),
      getStripe: () => ({
        checkout: {
          sessions: {
            retrieve: vi.fn().mockResolvedValue({ payment_status: "unpaid", id: "cs_exhausted" }),
          },
        },
      }),
    });
    const res = mockRes();
    await generateRoutes(opts)({ method: "POST", url: "/" }, res, () => {});
    expect(res.statusCode).toBe(402);
  });

  it("strips _stripe_session_id from evidence before validation and pipeline", async () => {
    awardCredits("cs_strip_test");
    let capturedEvidence = null;
    const opts = makeOptions({
      readJsonBody: vi.fn().mockResolvedValue({
        ...validEvidence,
        _stripe_session_id: "cs_strip_test",
      }),
      runPipeline: vi.fn((ev, _opts) => {
        capturedEvidence = ev;
        return Promise.resolve({ themes: {}, bullets: {}, stories: {}, self_eval: {} });
      }),
    });
    const handler = generateRoutes(opts);
    const req = { method: "POST", url: "/" };
    const res = mockRes();
    await handler(req, res, () => {});
    expect(capturedEvidence).not.toHaveProperty("_stripe_session_id");
  });
});
