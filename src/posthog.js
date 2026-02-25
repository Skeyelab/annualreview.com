import posthog from "posthog-js";

// POSTHOG_API_KEY from .env (exposed via vite.config envPrefix); optional VITE_POSTHOG_HOST for EU
const key = import.meta.env.VITE_POSTHOG_API_KEY || import.meta.env.POSTHOG_API_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

if (key) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: false, // we send pageviews from App on route change
    person_profiles: "identified_only",
  });
}

export { posthog };
