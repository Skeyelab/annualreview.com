// Dev server: serves the React app and API routes.
// Auth: GET /api/auth/github, GET /api/auth/callback/github, GET /api/auth/me, POST /api/auth/logout.
// POST /api/collect → 202 { job_id }; POST /api/generate → 202 { job_id }. Poll GET /api/jobs/:id for status/result.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { runPipeline } from "./lib/run-pipeline.js";
import { collectAndNormalize } from "./lib/collect-and-normalize.js";
import { validateEvidence } from "./lib/validate-evidence.js";
import { createJob, getJob, getLatestJob, runInBackground } from "./lib/job-store.js";
import { createSession, getSession, destroySession } from "./lib/session-store.js";
import {
  getAuthRedirectUrl,
  exchangeCodeForToken,
  getGitHubUser,
  handleCallback,
  handleMe,
  handleLogout,
} from "./lib/auth.js";
import {
  getSessionIdFromRequest,
  setSessionCookie,
  clearSessionCookie,
  setStateCookie,
  getStateFromRequest,
  clearStateCookie,
} from "./lib/cookies.js";

const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function respondJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function randomState() {
  return `st_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}

function apiRoutesPlugin() {
  return {
    name: "api-routes",
    configureServer(server, config) {
      const mode = config?.mode ?? "development";
      const env = loadEnv(mode, process.cwd(), "");
      const sessionSecret = env.SESSION_SECRET || process.env.SESSION_SECRET || "dev-secret";
      const clientId = env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
      const clientSecret = env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

      server.middlewares.use("/api/auth", (req, res, next) => {
        const path = req.url?.split("?")[0] || "";
        const isSecure = req.headers["x-forwarded-proto"] === "https";
        const host = req.headers.host || "localhost:5173";
        const origin = `${isSecure ? "https" : "http"}://${host}`;
        const redirectUri = `${origin}/api/auth/callback/github`;

        if (req.method === "GET" && path === "/github") {
          if (!clientId) {
            respondJson(res, 500, { error: "GITHUB_CLIENT_ID not set. Add it to .env and restart the dev server." });
            return;
          }
          const scope = (new URL(req.url || "", "http://x").searchParams.get("scope")) || "public";
          const state = `${scope}_${randomState()}`;
          setStateCookie(res, state, sessionSecret, { secure: isSecure });
          const url = getAuthRedirectUrl(scope, state, redirectUri, clientId);
          res.writeHead(302, { Location: url });
          res.end();
          return;
        }

        const cookieOpts = { secure: isSecure };
        if (req.method === "GET" && path === "/callback/github") {
          const fullUrl = `${origin}${req.url || ""}`;
          const callbackReq = { ...req, url: fullUrl };
          handleCallback(callbackReq, res, {
            getStateFromRequest: (r) => getStateFromRequest(r, sessionSecret),
            clearStateCookie,
            setSessionCookie,
            createSession,
            exchangeCodeForToken: (code, uri) =>
              exchangeCodeForToken(code, uri, clientId, clientSecret, fetch),
            getGitHubUser: (token) => getGitHubUser(token, fetch),
            redirectUri,
            sessionSecret,
            cookieOpts,
          }).catch((e) => {
            res.writeHead(500);
            res.end(e.message || "Callback failed");
          });
          return;
        }

        if (req.method === "GET" && path === "/me") {
          handleMe(req, res, {
            getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
            getSession: getSession,
          });
          return;
        }

        if (req.method === "POST" && path === "/logout") {
          handleLogout(req, res, {
            getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
            destroySession,
            clearSessionCookie,
          });
          return;
        }

        next();
      });

      server.middlewares.use("/api/jobs", (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        const path = (req.url?.split("?")[0] || "").replace(/^\/+/, "") || "";
        if (!path) {
          const sessionId = getSessionIdFromRequest(req, sessionSecret);
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
      });

      server.middlewares.use("/api/generate", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        try {
          const evidence = await readJsonBody(req);
          const validation = validateEvidence(evidence);
          if (!validation.valid) {
            const msg = validation.errors?.length
              ? validation.errors.map((e) => `${e.instancePath || "evidence"} ${e.message}`).join("; ")
              : "Evidence must have timeframe (start_date, end_date) and contributions array.";
            respondJson(res, 400, { error: "Invalid evidence", details: msg });
            return;
          }
          const jobId = createJob("generate");
          runInBackground(jobId, (report) =>
            runPipeline(evidence, {
              onProgress: ({ stepIndex, total, label }) => report({ progress: `${stepIndex}/${total} ${label}` }),
            })
          );
          respondJson(res, 202, { job_id: jobId });
        } catch (e) {
          respondJson(res, 500, { error: e.message || "Pipeline failed" });
        }
      });

      server.middlewares.use("/api/collect", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        try {
          const body = await readJsonBody(req);
          const { start_date, end_date } = body;
          if (!DATE_YYYY_MM_DD.test(start_date) || !DATE_YYYY_MM_DD.test(end_date)) {
            respondJson(res, 400, { error: "start_date and end_date must be YYYY-MM-DD" });
            return;
          }
          const sessionId = getSessionIdFromRequest(req, sessionSecret);
          const session = sessionId ? getSession(sessionId) : undefined;
          const token = session?.access_token ?? body.token;
          if (!token || typeof token !== "string") {
            respondJson(res, 401, { error: "token required (sign in with GitHub or send token in body)" });
            return;
          }
          const jobId = createJob("collect", sessionId || undefined);
          runInBackground(jobId, () =>
            collectAndNormalize({ token, start_date, end_date })
          );
          respondJson(res, 202, { job_id: jobId });
        } catch (e) {
          const status = (e.message || "").includes("401") || (e.message || "").includes("403") ? 401 : 500;
          respondJson(res, status, { error: e.message || "Fetch failed" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiRoutesPlugin()],
});
