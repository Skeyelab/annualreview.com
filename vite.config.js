// Dev server: serves the React app and API routes.
// Auth: GET /api/auth/github, GET /api/auth/callback/github, GET /api/auth/me, POST /api/auth/logout.
// POST /api/collect → 202 { job_id }; POST /api/generate → 202 { job_id }. Poll GET /api/jobs/:id for status/result.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { runPipeline } from "./lib/run-pipeline.js";
import { collectAndNormalize } from "./lib/collect-and-normalize.js";
import { validateEvidence } from "./lib/validate-evidence.js";
import { createJob, getJob, getLatestJob, runInBackground } from "./lib/job-store.js";
import { createSession, getSession, destroySession, setOAuthState, getAndRemoveOAuthState } from "./lib/session-store.js";
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
import { readJsonBody, respondJson, randomState, DATE_YYYY_MM_DD } from "./server/helpers.js";
import { authRoutes } from "./server/routes/auth.js";
import { jobsRoutes } from "./server/routes/jobs.js";
import { generateRoutes } from "./server/routes/generate.js";
import { collectRoutes } from "./server/routes/collect.js";

function apiRoutesPlugin() {
  return {
    name: "api-routes",
    configureServer(server, config) {
      const mode = config?.mode ?? "development";
      const env = loadEnv(mode, process.cwd(), "");
      const sessionSecret = env.SESSION_SECRET || process.env.SESSION_SECRET || "dev-secret";
      const clientId = env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
      const clientSecret = env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

      function getRequestContext(req) {
        const isSecure = req.headers["x-forwarded-proto"] === "https";
        const host = req.headers.host || "localhost:5173";
        const origin = `${isSecure ? "https" : "http"}://${host}`;
        const redirectUri = `${origin}/api/auth/callback/github`;
        return {
          origin,
          redirectUri,
          cookieOpts: { secure: isSecure },
          basePath: "", // req.url is full path when using Vite's connect
        };
      }

      server.middlewares.use(
        "/api/auth",
        authRoutes({
          sessionSecret,
          clientId,
          clientSecret,
          getRequestContext,
          getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
          getSession,
          destroySession,
          setSessionCookie,
          clearSessionCookie,
          setStateCookie,
          getStateFromRequest: (r) => getStateFromRequest(r, sessionSecret),
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
        })
      );

      server.middlewares.use(
        "/api/jobs",
        jobsRoutes({
          getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
          getLatestJob,
          getJob,
          respondJson,
        })
      );

      server.middlewares.use(
        "/api/generate",
        generateRoutes({
          readJsonBody,
          respondJson,
          validateEvidence,
          createJob,
          runInBackground,
          runPipeline,
        })
      );

      server.middlewares.use(
        "/api/collect",
        collectRoutes({
          readJsonBody,
          respondJson,
          DATE_YYYY_MM_DD,
          getSessionIdFromRequest: (r) => getSessionIdFromRequest(r, sessionSecret),
          getSession,
          createJob,
          runInBackground,
          collectAndNormalize,
        })
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), apiRoutesPlugin()],
  // Expose POSTHOG_API_KEY to client as VITE_POSTHOG_API_KEY (Vite only exposes VITE_* by default)
  envPrefix: ["VITE_", "POSTHOG"],
});
