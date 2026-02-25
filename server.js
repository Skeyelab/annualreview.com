/**
 * Production server: serves Vite build, POST /api/generate, OAuth + import.
 * Usage: PORT=3000 node server.js (after yarn build)
 * OAuth: set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET in .env or env.
 */

import "dotenv/config";
import express from "express";
import session from "express-session";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runPipeline } from "./lib/run-pipeline.js";
import { collectRaw } from "./scripts/collect-github.js";
import { normalize } from "./scripts/normalize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 3000;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", 1);
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(express.static(dist));

// ——— OAuth ———
app.get("/api/auth/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    res.status(503).json({ error: "OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." });
    return;
  }
  const redirectUri = `${BASE_URL.replace(/\/$/, "")}/api/auth/github/callback`;
  const scope = "read:user public_repo";
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  res.redirect(url);
});

app.get("/api/auth/github/callback", async (req, res) => {
  if (!GITHUB_CLIENT_SECRET) {
    res.redirect("/generate?error=oauth_not_configured");
    return;
  }
  const { code } = req.query;
  if (!code) {
    res.redirect("/generate?error=missing_code");
    return;
  }
  const redirectUri = `${BASE_URL.replace(/\/$/, "")}/api/auth/github/callback`;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      res.redirect(`/generate?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
      return;
    }
    req.session.githubAccessToken = tokenData.access_token;
    res.redirect("/generate");
  } catch (e) {
    res.redirect(`/generate?error=${encodeURIComponent(e.message || "Token exchange failed")}`);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.redirect("/");
});

// ——— Import from GitHub ———
app.post("/api/import", async (req, res) => {
  const token = req.session?.githubAccessToken;
  if (!token) {
    res.status(401).json({ error: "Not signed in. Connect GitHub first." });
    return;
  }
  const { start_date, end_date } = req.body || {};
  if (!start_date || !end_date) {
    res.status(400).json({ error: "start_date and end_date required (YYYY-MM-DD)." });
    return;
  }
  try {
    const raw = await collectRaw({
      start: start_date,
      end: end_date,
      noReviews: false,
      token,
    });
    const evidence = normalize(raw, start_date, end_date);
    res.json(evidence);
  } catch (e) {
    res.status(500).json({ error: e.message || "Import failed." });
  }
});

app.get("/api/me", (req, res) => {
  if (req.session?.githubAccessToken) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

// ——— Generate ———
app.post("/api/generate", async (req, res) => {
  try {
    const evidence = req.body;
    const result = await runPipeline(evidence);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || "Pipeline failed" });
  }
});

app.get("*", (_, res) => {
  res.sendFile(join(dist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Listening on http://0.0.0.0:${PORT}`);
});
