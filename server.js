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
import { createSession, getSession, destroySession, setOAuthState, getAndRemoveOAuthState } from "./lib/session-store.js";
import {
  getAuthRedirectUrl,
  buildCallbackRequest,
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
import { readJsonBody, respondJson, randomState, DATE_YYYY_MM_DD } from "./server/helpers.js";
import { authRoutes } from "./server/routes/auth.js";
import { jobsRoutes } from "./server/routes/jobs.js";
import { generateRoutes } from "./server/routes/generate.js";
import { collectRoutes } from "./server/routes/collect.js";

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
  const log = (event, detail) => console.error("[auth] " + event + (detail ? " " + detail : ""));

  if (path.startsWith("api/")) {
    const sub = path.slice(4);
    const [area, ...rest] = sub.split("/");
    const restPath = rest.join("/");
    const pathAndQs = restPath + (qs ? "?" + qs : "");
    const wrappedReq = Object.assign(Object.create(req), { url: pathAndQs ? "/" + pathAndQs : "/" });

    function next() {
      serveStatic(res, pathname);
    }

    if (area === "auth") {
      authRoutes({
        sessionSecret,
        clientId,
        clientSecret,
        getRequestContext: () => ({ origin, redirectUri, cookieOpts, basePath: "/api/auth" }),
        getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
        getSession,
        destroySession,
        setSessionCookie,
        clearSessionCookie,
        setStateCookie,
        getStateFromRequest: (r) => getStateFromRequest(r, sessionSecret, { log }),
        clearStateCookie,
        getAndRemoveOAuthState,
        setOAuthState,
        createSession,
        exchangeCodeForToken: (code, uri) =>
          exchangeCodeForToken(code, uri, clientId, clientSecret, fetch),
        getGitHubUser: (token) => getGitHubUser(token, fetch),
        handleCallback,
        handleMe,
        handleLogout,
        getAuthRedirectUrl,
        respondJson,
        randomState,
        buildCallbackRequest,
        log,
      })(wrappedReq, res, next);
      return;
    }

    if (area === "jobs") {
      jobsRoutes({
        getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
        getLatestJob,
        getJob,
        respondJson,
      })(wrappedReq, res, next);
      return;
    }

    if (area === "generate") {
      generateRoutes({
        readJsonBody,
        respondJson,
        validateEvidence,
        createJob,
        runInBackground,
        runPipeline,
      })(wrappedReq, res, next);
      return;
    }

    if (area === "collect") {
      collectRoutes({
        readJsonBody,
        respondJson,
        DATE_YYYY_MM_DD,
        getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
        getSession,
        createJob,
        runInBackground,
        collectAndNormalize,
      })(wrappedReq, res, next);
      return;
    }
  }

  serveStatic(res, pathname);
}

const port = Number(process.env.PORT) || 3000;
createServer(handleRequest).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
