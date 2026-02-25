import React from "react";

export default function CollectForm({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  error,
  progress,
  loading,
  onSubmit,
  submitLabel = "Fetch my data",
  children,
}) {
  return (
    <div className="generate-collect-form">
      {children}
      <div className="generate-collect-dates">
        <label className="generate-collect-label">
          From <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className="generate-collect-date" />
        </label>
        <label className="generate-collect-label">
          To <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} className="generate-collect-date" />
        </label>
      </div>
      {error && <p className="generate-error">{error}</p>}
      {progress && <p className="generate-progress">{progress}</p>}
      <button type="button" className="generate-collect-btn" onClick={onSubmit} disabled={loading}>
        {loading ? "Fetching…" : submitLabel}
      </button>
    </div>
  );
}
