import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not authenticated"))))
      .then((data) => setUser({ login: data.login, scope: data.scope }))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => setUser(null));
  }, []);

  return { user, authChecked, logout };
}
