import React from "react";

/** One pipeline output section: title, copy button, pretty-printed JSON. */
export default function ResultSection({ title, data }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <section className="generate-section">
      <div className="generate-section-head">
        <h3>{title}</h3>
        <button type="button" className="generate-copy" onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
      </div>
      <pre className="generate-pre">{text}</pre>
    </section>
  );
}
