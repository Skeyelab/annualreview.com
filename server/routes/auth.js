/**
 * Auth API routes: GET /github, GET /callback/github, GET /me, POST /logout.
 * Export a function that returns a Connect-style middleware (req, res, next).
 * All dependencies are passed in options so Vite and server.js can share this.
 *
 * @param {{
 *   sessionSecret: string,
 *   clientId: string | undefined,
 *   clientSecret: string | undefined,
 *   getRequestContext: (req) => ({ origin, redirectUri, cookieOpts, basePath }). basePath e.g. "/api/auth" when req.url is path under mount.
 *   getSessionIdFromRequest: (req: any) => string | null,
 *   getSession: (id: string) => any,
 *   destroySession: (id: string) => void,
 *   setSessionCookie: (res: any, id: string, secret: string, opts?: object) => void,
 *   clearSessionCookie: (res: any) => void,
 *   setStateCookie: (res: any, state: string, secret: string, opts?: object) => void,
 *   getStateFromRequest: (req: any) => string | null,
 *   clearStateCookie: (res: any) => void,
 *   getAndRemoveOAuthState?: (state: string) => string | null,
 *   setOAuthState: (id: string, state: string) => void,
 *   createSession: (data: object) => string,
 *   exchangeCodeForToken: (code: string, redirectUri: string) => Promise<string>,
 *   getGitHubUser: (token: string) => Promise<{ login: string }>,
 *   handleCallback: (req: any, res: any, deps: object) => Promise<void>,
 *   handleMe: (req: any, res: any, deps: object) => void,
 *   handleLogout: (req: any, res: any, deps: object) => void,
 *   getAuthRedirectUrl: (scope: string, state: string, redirectUri: string, clientId: string) => string,
 *   respondJson: (res: any, status: number, data: object) => void,
 *   randomState: () => string,
 *   buildCallbackRequest?: (req: any, fullUrl: string) => any,
 *   log?: (event: string, detail?: string) => void,
 * }} options
 */
export function authRoutes(options) {
  const {
    sessionSecret,
    clientId,
    clientSecret,
    getRequestContext,
    getSessionIdFromRequest,
    getSession,
    destroySession,
    setSessionCookie,
    clearSessionCookie,
    setStateCookie,
    getStateFromRequest,
    clearStateCookie,
    getAndRemoveOAuthState,
    setOAuthState,
    createSession,
    exchangeCodeForToken,
    getGitHubUser,
    handleCallback,
    handleMe,
    handleLogout,
    getAuthRedirectUrl,
    respondJson,
    randomState,
    buildCallbackRequest,
    log = () => {},
  } = options;

  return function authMiddleware(req, res, next) {
    const path = (req.url?.split("?")[0] || "").replace(/^\/+/, "") || "";
    const { origin, redirectUri, cookieOpts, basePath = "" } = getRequestContext(req);
    const isSecure = cookieOpts?.secure ?? req.headers["x-forwarded-proto"] === "https";

    if (req.method === "GET" && path === "github") {
      if (!clientId) {
        respondJson(res, 500, {
          error: "GITHUB_CLIENT_ID not set. Add it to .env and restart the dev server.",
        });
        return;
      }
      const scope =
        (new URL(req.url || "", "http://x").searchParams.get("scope")) || "public";
      const state = `${scope}_${randomState()}`;
      setStateCookie(res, state, sessionSecret, { secure: isSecure });
      setOAuthState(state, state);
      const url = getAuthRedirectUrl(scope, state, redirectUri, clientId);
      res.writeHead(302, { Location: url });
      res.end();
      return;
    }

    if (req.method === "GET" && path === "callback/github") {
      const pathPart = req.url?.startsWith("/") ? req.url : "/" + (req.url || "");
      const fullUrl = `${origin}${basePath}${pathPart}`;
      const callbackReq = buildCallbackRequest
        ? buildCallbackRequest(req, fullUrl)
        : { ...req, url: fullUrl };
      handleCallback(callbackReq, res, {
        getStateFromRequest,
        getAndRemoveOAuthState,
        clearStateCookie,
        setSessionCookie,
        createSession,
        exchangeCodeForToken,
        getGitHubUser,
        redirectUri,
        sessionSecret,
        cookieOpts,
        log,
      }).catch((e) => {
        log("callback_error", e.message || "unknown");
        res.writeHead(500);
        res.end(e.message || "Callback failed");
      });
      return;
    }

    if (req.method === "GET" && path === "me") {
      handleMe(req, res, {
        getSessionIdFromRequest,
        getSession,
      });
      return;
    }

    if (req.method === "POST" && path === "logout") {
      handleLogout(req, res, {
        getSessionIdFromRequest,
        destroySession,
        clearSessionCookie,
      });
      return;
    }

    next();
  };
}
