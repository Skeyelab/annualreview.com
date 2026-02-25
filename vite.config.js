import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { runPipeline } from "./lib/run-pipeline.js";
import { collectRaw } from "./scripts/collect-github.js";
import { normalize } from "./scripts/normalize.js";

// In-memory session store: sessionId → { token, login, avatar_url }
const sessions = new Map();

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getSessionId(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/ar_session=([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

function authPlugin() {
  return {
    name: "api-auth",
    configureServer(server) {
      server.middlewares.use("/api/auth", (req, res, next) => {
        const rawUrl = req.url || "/";
        const url = new URL(rawUrl, "http://localhost");
        const path = url.pathname;

        const json = (data, status = 200) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        if (req.method === "GET" && path === "/start") {
          const clientId = process.env.GITHUB_CLIENT_ID;
          if (!clientId) {
            json({ error: "GITHUB_CLIENT_ID not set. See docs/setup-github-oauth.md." }, 500);
            return;
          }
          const scope =
            url.searchParams.get("scope") === "private"
              ? "read:user repo"
              : "read:user public_repo";
          const ghUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`;
          res.statusCode = 302;
          res.setHeader("Location", ghUrl);
          res.end();

        } else if (req.method === "GET" && path === "/callback") {
          const code = url.searchParams.get("code");
          const clientId = process.env.GITHUB_CLIENT_ID;
          const clientSecret = process.env.GITHUB_CLIENT_SECRET;
          if (!code || !clientId || !clientSecret) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain");
            res.end("Missing OAuth parameters. Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set.");
            return;
          }
          (async () => {
            const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
              method: "POST",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.error || !tokenData.access_token) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "text/plain");
              res.end(`OAuth error: ${tokenData.error_description || tokenData.error || "unknown"}`);
              return;
            }
            const userRes = await fetch("https://api.github.com/user", {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/vnd.github.v3+json",
              },
            });
            const user = await userRes.json();
            const sessionId = randomId();
            sessions.set(sessionId, {
              token: tokenData.access_token,
              login: user.login,
              avatar_url: user.avatar_url,
            });
            res.statusCode = 302;
            res.setHeader("Set-Cookie", `ar_session=${sessionId}; Path=/; SameSite=Lax; HttpOnly`);
            res.setHeader("Location", "/generate");
            res.end();
          })().catch((e) => {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain");
            res.end(e.message || "OAuth callback failed");
          });

        } else if (req.method === "GET" && path === "/me") {
          const sid = getSessionId(req);
          const session = sid ? sessions.get(sid) : null;
          json(
            session
              ? { connected: true, login: session.login, avatar_url: session.avatar_url }
              : { connected: false }
          );

        } else if (req.method === "POST" && path === "/disconnect") {
          const sid = getSessionId(req);
          if (sid) sessions.delete(sid);
          res.setHeader("Set-Cookie", "ar_session=; Path=/; Max-Age=0; HttpOnly");
          json({ ok: true });

        } else {
          next();
        }
      });
    },
  };
}

function importPlugin() {
  return {
    name: "api-import",
    configureServer(server) {
      server.middlewares.use("/api/import", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const sid = getSessionId(req);
        const session = sid ? sessions.get(sid) : null;
        if (!session) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Not connected to GitHub. Please connect first." }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          (async () => {
            const { start, end } = JSON.parse(body);
            if (!start || !end) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "start and end dates required" }));
              return;
            }
            const raw = await collectRaw({ start, end, token: session.token });
            const evidence = normalize(raw, start, end);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(evidence));
          })().catch((e) => {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message || "Import failed" }));
          });
        });
      });
    },
  };
}

function apiGeneratePlugin() {
  return {
    name: "api-generate",
    configureServer(server) {
      server.middlewares.use("/api/generate", (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const evidence = JSON.parse(body);
            const result = await runPipeline(evidence);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message || "Pipeline failed" }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), authPlugin(), importPlugin(), apiGeneratePlugin()],
});
