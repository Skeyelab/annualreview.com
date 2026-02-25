import { createHmac } from "crypto";

const COOKIE_NAME = "ar_session";

/**
 * @param {string} id
 * @param {string} secret
 * @returns {string}
 */
export function signSessionId(id, secret) {
  const sig = createHmac("sha256", secret).update(id).digest("hex");
  return `${id}.${sig}`;
}

/**
 * @param {string} value
 * @param {string} secret
 * @returns {string | null}
 */
export function verifySessionId(value, secret) {
  if (!value || typeof value !== "string") return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const id = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  return sig === expected ? id : null;
}

/**
 * @param {{ headers?: { cookie?: string } }} req
 * @param {string} secret
 * @returns {string | null}
 */
export function getSessionIdFromRequest(req, secret) {
  const cookie = req?.headers?.cookie;
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const value = decodeURIComponent(match[1].trim());
  return verifySessionId(value, secret);
}

/**
 * @param {{ setHeader: (k: string, v: string) => void }} res
 * @param {string} sessionId
 * @param {string} secret
 * @param {{ secure?: boolean, maxAge?: number }} opts
 */
export function setSessionCookie(res, sessionId, secret, opts = {}) {
  const value = signSessionId(sessionId, secret);
  const secure = opts.secure ?? false;
  const maxAge = opts.maxAge ?? 60 * 60 * 24 * 7; // 7 days
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/**
 * @param {{ setHeader: (k: string, v: string) => void }} res
 */
export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

const STATE_COOKIE = "ar_oauth_state";

/**
 * @param {{ setHeader: (k: string, v: string) => void }} res
 * @param {string} state
 * @param {string} secret
 * @param {{ secure?: boolean }} opts
 */
export function setStateCookie(res, state, secret, opts = {}) {
  const secretTrimmed = String(secret).trim();
  const sig = createHmac("sha256", secretTrimmed).update(state).digest("hex");
  const value = `${state}.${sig}`;
  const parts = [
    `${STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
  ];
  if (opts.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/**
 * @param {{ headers?: { cookie?: string } }} req
 * @param {string} secret
 * @param {{ log?: (msg: string, detail?: string) => void }} opts
 * @returns {string | null}
 */
export function getStateFromRequest(req, secret, opts = {}) {
  const log = opts.log || (() => {});
  const cookie = req?.headers?.cookie;
  if (!cookie || !secret) {
    if (!secret) log("state_cookie", "no_secret");
    return null;
  }
  const match = cookie.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
  if (!match) {
    log("state_cookie", "no_match");
    return null;
  }
  const raw = decodeURIComponent(match[1].trim());
  const i = raw.lastIndexOf(".");
  if (i <= 0) {
    log("state_cookie", "bad_format");
    return null;
  }
  const state = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const secretTrimmed = String(secret).trim();
  const expected = createHmac("sha256", secretTrimmed).update(state).digest("hex");
  if (sig !== expected) {
    log("state_cookie", "verify_failed");
    return null;
  }
  return state;
}

/**
 * @param {{ setHeader: (k: string, v: string) => void }} res
 */
export function clearStateCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
