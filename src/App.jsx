// Path-based routing: /generate → Generate page, else Landing. No router library.
import { useState, useEffect } from "react";
import Landing from "./Landing";
import Generate from "./Generate";
import { posthog } from "./posthog";

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    posthog?.capture("$pageview", { path });
  }, [path]);

  return path === "/generate" ? <Generate /> : <Landing />;
}
