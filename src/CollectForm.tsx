import React, { type ReactNode } from "react";

export interface CollectDateRangeProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function CollectDateRange({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: CollectDateRangeProps) {
  return (
    <div className="generate-collect-dates">
      <label className="generate-collect-label">
        From{" "}
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="generate-collect-date"
        />
      </label>
      <label className="generate-collect-label">
        To{" "}
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="generate-collect-date"
        />
      </label>
    </div>
  );
}

interface CollectFormProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  error: string | null;
  progress: string;
  loading: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  children?: ReactNode;
}

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
}: CollectFormProps) {
  return (
    <div className="generate-collect-form">
      {children}
      <CollectDateRange
        startDate={startDate}
        endDate={endDate}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />
      {error && <p className="generate-error">{error}</p>}
      {progress && <p className="generate-progress">{progress}</p>}
      <button
        type="button"
        className="generate-collect-btn"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "Fetching…" : submitLabel}
      </button>
    </div>
  );
}
