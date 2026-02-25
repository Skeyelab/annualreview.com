/**
 * Shared helpers for API routes. Used by both Vite dev server and production server.js.
 */

export const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<object>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {object} data
 */
export function respondJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/**
 * @returns {string}
 */
export function randomState() {
  return `st_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}
