import "./Landing.css";

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-logo">
          <span className="landing-logo-icon">⟡</span>
          <span className="landing-logo-text">Annual Review Story</span>
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-hero">
          <p className="landing-pipe">GitHub → evidence → narrative</p>
          <h1 className="landing-title">
            Turn your contributions into an evidence-backed annual review.
          </h1>
          <p className="landing-lead">
            Connect your account, pick a timeframe, and get themes, impact bullets,
            STAR stories, and an appendix of links—every claim traceable to a PR or review.
          </p>
          <div className="landing-cta">
            <a href="/generate" className="landing-btn landing-btn-primary">
              Generate a review
            </a>
            <a href="/api/auth/github" className="landing-btn landing-btn-ghost">
              Connect GitHub
            </a>
            <a href="#how" className="landing-btn landing-btn-ghost">
              How it works
            </a>
          </div>
        </div>

        <section id="how" className="landing-section">
          <h2 className="landing-section-title">How it works</h2>
          <ol className="landing-steps">
            <li>
              <span className="landing-step-num">1</span>
              <span className="landing-step-text"><strong>Connect</strong> — Sign in with GitHub (public repos only or include private).</span>
            </li>
            <li>
              <span className="landing-step-num">2</span>
              <span className="landing-step-text"><strong>Select</strong> — Choose date range and repos to include.</span>
            </li>
            <li>
              <span className="landing-step-num">3</span>
              <span className="landing-step-text"><strong>Generate</strong> — Get themes, bullets, STAR stories, and an evidence appendix.</span>
            </li>
            <li>
              <span className="landing-step-num">4</span>
              <span className="landing-step-text"><strong>Copy</strong> — Export to Markdown or paste into your review form.</span>
            </li>
          </ol>
        </section>

        <section className="landing-section landing-section-dark">
          <h2 className="landing-section-title">No fluff, no guesswork</h2>
          <p className="landing-tagline">
            We only use what’s in your GitHub activity. Unproven impact is labeled
            <em> “needs confirmation”</em>—so you stay accurate and credible.
          </p>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          For ICs, tech leads, and contractors writing self-evals and promotion packets.
        </p>
      </footer>
    </div>
  );
}
