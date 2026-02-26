// Marketing landing: hero, features, how-it-works, CTA. Sticky "Generate" bar after scrolling past hero.
import React, { useState, useEffect } from "react";
import "./Landing.css";
import { posthog } from "./posthog";

const SCROLL_Y_SHOW_STICKY_CTA = 400;

const FEATURES = [
  {
    icon: "◈",
    title: "Theme Clusters",
    desc: "Your scattered PRs distilled into 4–6 strategic themes a manager actually remembers.",
  },
  {
    icon: "▹",
    title: "Impact Bullets",
    desc: "XYZ-format bullets with scope, outcome, and a link to the PR that proves it.",
  },
  {
    icon: "☆",
    title: "STAR Stories",
    desc: "Ready-to-paste Situation/Task/Action/Result narratives for promotion packets.",
  },
  {
    icon: "⎋",
    title: "Self-eval Sections",
    desc: "Draft summary and self-eval sections for review forms. Every claim linked to a PR.",
  },
];

const STEPS = [
  {
    verb: "Connect",
    detail:
      "Sign in with GitHub (public or private), or paste a token. CLI option keeps your token on your machine.",
  },
  {
    verb: "Fetch",
    detail:
      "Set your review date range and fetch your PRs and reviews in one click.",
  },
  {
    verb: "Generate",
    detail:
      "One click: themes, bullets, STAR stories, and self-eval sections—all evidence-linked. Optionally add your goals so the report is tailored to what you're being measured on.",
  },
  {
    verb: "Ship it",
    detail:
      "Copy sections or download the full report as Markdown. Done before lunch.",
  },
];

export default function Landing() {
  const [showStickyCta, setShowStickyCta] = useState(false);
  const authError =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("error") === "auth_failed";

  useEffect(() => {
    const onScroll = () =>
      setShowStickyCta(window.scrollY > SCROLL_Y_SHOW_STICKY_CTA);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing">
      {showStickyCta && (
        <div className="sticky-cta" role="banner">
          <div className="sticky-cta-inner">
            <span className="sticky-cta-text">
              Turn your GitHub activity into a review in 5 minutes.
            </span>
            <a
              href="/generate"
              className="btn btn-primary"
              onClick={() =>
                posthog?.capture("cta_clicked", { location: "sticky" })
              }
            >
              Generate my review <span className="btn-arrow">→</span>
            </a>
          </div>
        </div>
      )}
      {authError && (
        <div className="auth-error-banner" role="alert">
          <p>
            GitHub sign-in didn't complete. Try again from the Generate page, or
            check that your production URL is set as the callback URL in your
            GitHub OAuth app.
          </p>
          <a href="/">Dismiss</a>
        </div>
      )}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="nav-brand">
            <span className="nav-icon">⟡</span>
            <span>AnnualReview.dev</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a
              href="/generate"
              className="nav-cta"
              onClick={() =>
                posthog?.capture("cta_clicked", { location: "nav" })
              }
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-bg" aria-hidden="true" />
          <div className="container hero-content">
            <p className="hero-kicker">GitHub → evidence → narrative</p>
            <h1 className="hero-title">
              Stop putting off
              <br />
              your self-review.
            </h1>
            <p className="hero-sub">
              You shipped all year. You shouldn't have to spend a week proving
              it. <strong>Free, no signup.</strong> Sign in with GitHub, use a
              token, or run the CLI. Get themes, bullets, STAR stories, and
              self-eval sections—every claim linked to a real PR. Optionally add
              your annual goals to tailor the report to what you're being
              measured on.
            </p>
            <div className="hero-actions">
              <a
                href="/generate"
                className="btn btn-primary btn-lg"
                onClick={() =>
                  posthog?.capture("cta_clicked", { location: "hero" })
                }
              >
                Generate my review
                <span className="btn-arrow">→</span>
              </a>
              <a href="#how" className="hero-secondary-link">
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ── Social proof bar ── */}
        <section className="proof-bar">
          <div className="container">
            <p className="proof-text">
              Free · No signup · Your data stays yours. Built for ICs, tech
              leads, and contractors who'd rather ship code than write about it.
            </p>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="section">
          <div className="container">
            <p className="section-kicker">What you get</p>
            <h2 className="section-title">Four outputs. Zero guesswork.</h2>
            <div className="feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-card">
                  <span className="feature-icon">{f.icon}</span>
                  <h3 className="feature-name">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Before / After ── */}
        <section className="section section-alt">
          <div className="container">
            <p className="section-kicker">The transformation</p>
            <h2 className="section-title">
              From commit log to career narrative
            </h2>
            <div className="compare-grid">
              <div className="compare-card compare-before">
                <span className="compare-label">Before</span>
                <div className="compare-body mono">
                  <p>fix: handle null user in auth middleware</p>
                  <p>feat: add retry logic to webhook dispatcher</p>
                  <p>chore: bump deps, fix lint warnings</p>
                  <p>refactor: extract billing service from monolith</p>
                  <p className="text-muted">…47 more commits</p>
                </div>
              </div>
              <div className="compare-card compare-after">
                <span className="compare-label">After</span>
                <div className="compare-body">
                  <p>
                    <strong>Platform Reliability</strong>
                  </p>
                  <p>
                    Improved webhook delivery success rate by adding retry logic
                    with exponential backoff, reducing failed deliveries across 3
                    integration partners.
                    <span className="evidence-tag">PR #412</span>
                  </p>
                  <p>
                    <strong>Architecture</strong>
                  </p>
                  <p>
                    Led extraction of billing service from the monolith, enabling
                    independent deployment and reducing blast radius.
                    <span className="evidence-tag">PR #389</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="section">
          <div className="container">
            <p className="section-kicker">4 steps, 5 minutes</p>
            <h2 className="section-title">How it works</h2>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.verb} className="step">
                  <span className="step-num">{i + 1}</span>
                  <div>
                    <strong className="step-verb">{s.verb}</strong>
                    <p className="step-detail">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="section section-alt">
          <div className="container trust-container">
            <p className="section-kicker">Why trust this</p>
            <h2 className="section-title">Evidence-only. Always.</h2>
            <div className="trust-grid">
              <div className="trust-item">
                <strong>No hallucinated metrics</strong>
                <p>
                  If we can't link it to a PR, it doesn't appear in your
                  review.
                </p>
              </div>
              <div className="trust-item">
                <strong>Flagged uncertainty</strong>
                <p>
                  Unproven impact is labeled
                  <em> "needs confirmation"</em> so you stay credible.
                </p>
              </div>
              <div className="trust-item">
                <strong>Your data, your machine</strong>
                <p>
                  Runs locally or on your infra. Nothing stored, nothing shared.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="final-cta">
          <div className="container">
            <h2 className="final-cta-title">
              Review season is coming.
              <br />
              Be ready in 5 minutes.
            </h2>
            <a
              href="/generate"
              className="btn btn-primary btn-lg"
              onClick={() =>
                posthog?.capture("cta_clicked", { location: "final" })
              }
            >
              Generate my review
              <span className="btn-arrow">→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <a href="/" className="footer-brand">
            <span className="nav-icon">⟡</span> AnnualReview.dev
          </a>
          <p className="footer-sub">
            For engineers who ship more than they self-promote.{" "}
            <a
              href="https://github.com/Skeyelab/annualreview.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
