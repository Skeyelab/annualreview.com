/**
 * GitHub OAuth: redirect URL, token exchange, user fetch, callback/me/logout handlers.
 */

const GITHUB_AUTH = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";

const SCOPES = {
  public: "read:user public_repo",
  private: "read:user repo",
};

/**
 * @param {"public" | "private"} scope
 * @param {string} state
 * @param {string} redirectUri
 * @param {string} clientId
 * @returns {string}
 */
export function getAuthRedirectUrl(scope, state, redirectUri, clientId) {
  const s = SCOPES[scope] || SCOPES.public;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: s,
    state,
  });
  return `${GITHUB_AUTH}?${params.toString()}`;
}

/**
 * @param {string} code
 * @param {string} redirectUri
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {typeof fetch} fetchFn
 * @returns {Promise<string>} access_token
 */
export async function exchangeCodeForToken(code, redirectUri, clientId, clientSecret, fetchFn) {
  const res = await fetchFn(GITHUB_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token;
}

/**
 * @param {string} accessToken
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ login: string }>}
 */
export async function getGitHubUser(accessToken, fetchFn) {
  const res = await fetchFn(GITHUB_USER, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`User fetch failed: ${res.status}`);
  const user = await res.json();
  return { login: user.login };
}

/**
 * @param {{ url?: string, headers?: { cookie?: string } }} req
 * @param {{ writeHead: (code: number, headers?: object) => void, end: (body?: string) => void, setHeader: (k: string, v: string) => void }} res
 * @param {{
 *   getStateFromRequest: (req: any) => string | null,
 *   getAndRemoveOAuthState?: (state: string) => string | null,
 *   clearStateCookie: (res: any) => void,
 *   setSessionCookie: (res: any, id: string, secret: string, opts?: object) => void,
 *   createSession: (data: object) => string,
 *   exchangeCodeForToken: (code: string, redirectUri: string) => Promise<string>,
 *   getGitHubUser: (token: string) => Promise<{ login: string }>,
 *   redirectUri: string,
 *   sessionSecret: string,
 *   cookieOpts?: { secure?: boolean },
 *   scope?: string,
 * }} deps
 */
export async function handleCallback(req, res, deps) {
  const url = req.url || "";
  const search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  const params = new URLSearchParams(search);
  const code = params.get("code");
  const stateParam = params.get("state");
  const storedState =
    deps.getStateFromRequest(req) ??
    (stateParam && deps.getAndRemoveOAuthState ? deps.getAndRemoveOAuthState(stateParam) : null);

  const fail = () => {
    deps.clearStateCookie(res);
    res.writeHead(302, { Location: "/?error=auth_failed" });
    res.end();
  };

  if (!code || !stateParam || !storedState || stateParam !== storedState) {
    fail();
    return;
  }

  const scope = stateParam.includes("_") ? stateParam.slice(0, stateParam.indexOf("_")) : (deps.scope || "public");
  const redirectUri = deps.redirectUri;
  let access_token;
  try {
    access_token = await deps.exchangeCodeForToken(code, redirectUri);
  } catch {
    fail();
    return;
  }
  const user = await deps.getGitHubUser(access_token);
  const sessionId = deps.createSession({
    access_token,
    login: user.login,
    scope,
  });
  deps.clearStateCookie(res);
  deps.setSessionCookie(res, sessionId, deps.sessionSecret, deps.cookieOpts || {});
  res.writeHead(302, { Location: "/generate" });
  res.end();
}

/**
 * @param {{ headers?: object }} req
 * @param {{ statusCode?: number, setHeader: (k: string, v: string) => void, end: (body?: string) => void }} res
 * @param {{ getSessionIdFromRequest: (req: any) => string | null, getSession: (id: string) => { login: string, scope?: string } | undefined }} deps
 */
export function handleMe(req, res, deps) {
  const sessionId = deps.getSessionIdFromRequest(req);
  const session = sessionId ? deps.getSession(sessionId) : undefined;
  if (!session) {
    res.writeHead(401);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ login: session.login, scope: session.scope }));
}

/**
 * @param {{ headers?: object }} req
 * @param {{ writeHead: (code: number) => void, end: () => void }} res
 * @param {{ getSessionIdFromRequest: (req: any) => string | null, destroySession: (id: string) => void, clearSessionCookie: (res: any) => void }} deps
 */
export function handleLogout(req, res, deps) {
  const sessionId = deps.getSessionIdFromRequest(req);
  if (sessionId) deps.destroySession(sessionId);
  deps.clearSessionCookie(res);
  res.writeHead(204);
  res.end();
}
