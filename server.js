/**
 * Production server: serves dist/ and the same API routes as the Vite dev server.
 * For Coolify (or any Node host): run `yarn build && node server.js`.
 * Set PORT (default 3000), SESSION_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OPENAI_API_KEY.
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");

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

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function serveStatic(res, pathname) {
  const rel = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = join(DIST, rel);
  try {
    const data = await readFile(filePath);
    res.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
    res.end(data);
  } catch (e) {
    if (e.code === "ENOENT") {
      const index = await readFile(join(DIST, "index.html"));
      res.setHeader("Content-Type", "text/html");
      res.end(index);
    } else {
      res.statusCode = 500;
      res.end();
    }
  }
}

function handleRequest(req, res) {
  const url = req.url || "/";
  const [pathname, qs] = url.split("?");
  const path = pathname.replace(/^\/+/, "");

  const sessionSecret = process.env.SESSION_SECRET || "dev-secret";
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const isSecure = req.headers["x-forwarded-proto"] === "https";
  const host = req.headers.host || "localhost:3000";
  const origin = `${isSecure ? "https" : "http"}://${host}`;
  const redirectUri = `${origin}/api/auth/callback/github`;
  const cookieOpts = { secure: isSecure };

  if (path.startsWith("api/")) {
    const sub = path.slice(4);
    const [area, ...rest] = sub.split("/");

    if (area === "auth") {
      const authPath = rest.join("/");
      if (req.method === "GET" && authPath === "github") {
        if (!clientId) {
          respondJson(res, 500, { error: "GITHUB_CLIENT_ID not set" });
          return;
        }
        const scope = new URL(url, "http://x").searchParams.get("scope") || "public";
        const state = `${scope}_${randomState()}`;
        setStateCookie(res, state, sessionSecret, { secure: isSecure });
        const authUrl = getAuthRedirectUrl(scope, state, redirectUri, clientId);
        res.writeHead(302, { Location: authUrl });
        res.end();
        return;
      }
      if (req.method === "GET" && authPath === "callback/github") {
        const fullUrl = `${origin}${url}`;
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
      if (req.method === "GET" && authPath === "me") {
        handleMe(req, res, {
          getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
          getSession,
        });
        return;
      }
      if (req.method === "POST" && authPath === "logout") {
        handleLogout(req, res, {
          getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
          destroySession,
          clearSessionCookie,
        });
        return;
      }
    }

    if (area === "jobs" && req.method === "GET") {
      const jobPath = rest.join("/");
      if (!jobPath) {
        const sessionId = getSessionIdFromRequest(req, sessionSecret);
        const latest = sessionId ? getLatestJob(sessionId) : null;
        respondJson(res, 200, latest ? { latest } : { latest: null });
        return;
      }
      const job = getJob(decodeURIComponent(jobPath));
      if (!job) {
        respondJson(res, 404, { error: "Job not found" });
        return;
      }
      respondJson(res, 200, job);
      return;
    }

    if (area === "generate" && req.method === "POST") {
      readJsonBody(req).then((evidence) => {
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
      }).catch((e) => {
        respondJson(res, 500, { error: e.message || "Pipeline failed" });
      });
      return;
    }

    if (area === "collect" && req.method === "POST") {
      readJsonBody(req).then((body) => {
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
      }).catch((e) => {
        const status = (e.message || "").includes("401") || (e.message || "").includes("403") ? 401 : 500;
        respondJson(res, status, { error: e.message || "Fetch failed" });
      });
      return;
    }
  }

  serveStatic(res, pathname);
}

const port = Number(process.env.PORT) || 3000;
createServer(handleRequest).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
