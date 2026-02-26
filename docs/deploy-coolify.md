# Deploying to Coolify

Coolify works best with **Docker Compose**. The repo includes a compose file that runs the Rails API, Solid Queue worker, and the React frontend (nginx + SPA).

## Option 1: Docker Compose (Rails stack, recommended)

1. **In Coolify:** Create a new resource → **Docker Compose**. Point it at this repo and use the root `docker-compose.yml`.

2. **Environment variables** (Coolify → your service → Environment)
   - `RAILS_MASTER_KEY` — from `backend/config/master.key` (required; Coolify will prompt if missing)
   - `GITHUB_CLIENT_ID` — from [GitHub OAuth App](https://github.com/settings/developers)
   - `GITHUB_CLIENT_SECRET` — from the same OAuth App
   - `OPENAI_API_KEY` — for the generate pipeline
   - **FRONTEND_URL:** Assign a domain to the **frontend** service in Coolify; Coolify then sets `SERVICE_URL_FRONTEND`, which the compose file uses for post-login redirects. Optionally you can set `FRONTEND_URL` manually instead. The frontend container listens on port 80, so no port is needed in the magic variable. For services on other ports use `SERVICE_URL_<NAME>_<PORT>` and **hyphens** in the identifier (e.g. `SERVICE_URL_MY-SERVICE_3000`). See [Coolify’s magic environment variables](https://coolify.io/docs/knowledge-base/docker/compose#coolifys-magic-environment-variables).

3. **GitHub OAuth App**
   - Set **Authorization callback URL** to:
     `https://<your-coolify-domain>/auth/github/callback`
   - (Requests hit the frontend; nginx proxies `/auth` to Rails.)

4. **What runs**
   - **frontend** — nginx serves the Vite build and proxies `/api` and `/auth` to the backend (port 80 exposed).
   - **backend** — Rails API (SQLite + Solid Queue in `backend_storage` volume).
   - **worker** — Solid Queue runner for collect/generate jobs.

5. **Proxy**
   - Coolify’s reverse proxy should send `X-Forwarded-Proto` and `Host`; the frontend container passes these to Rails.

---

## Option 2: Nixpacks (Node stack, legacy)

The repo includes `nixpacks.toml` so you can deploy the **Node** app (Vite build + Node server) without Docker Compose.

1. In Coolify, use **Nixpacks** (or a single-service Dockerfile) for this repo. Nixpacks will run `yarn build` and `yarn start`.

2. **Environment variables**
   - `SESSION_SECRET` — e.g. `openssl rand -hex 32`
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`
   - Optional: `POSTHOG_API_KEY`, `POSTHOG_HOST`

3. **GitHub OAuth**
   - Callback URL: `https://<your-coolify-domain>/api/auth/callback/github`

4. Coolify’s proxy should send `X-Forwarded-Proto: https` and `Host`.
