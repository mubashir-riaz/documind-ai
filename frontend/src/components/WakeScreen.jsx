export default function WakeScreen({ status, elapsedTime, attempt, retry, fadeOut }) {
  // If the app is ready and the fade out is complete (or not showing), do not render
  if (status === "ready" && !fadeOut) {
    return null;
  }

  const isWaking = status === "waking";
  const isError = status === "error";

  return (
    <div className={`wakescreen-overlay ${fadeOut ? "fade-out" : ""}`}>
      <div className="wakescreen-container">
        {/* Animated Brand Logo */}
        <div className="wakescreen-logo">
          Docu<span>Mind</span> AI
        </div>

        {/* --- WAKING STATE --- */}
        {isWaking && (
          <>
            <div className="wakescreen-spinner-container">
              <div className="wakescreen-spinner-glow" />
              <div className="wakescreen-spinner" />
            </div>

            <div className="wakescreen-content">
              <h2 className="wakescreen-title">Starting DocuMind AI...</h2>
              <p className="wakescreen-subtitle">Waking up server...</p>
              
              <div className="wakescreen-metrics">
                <div className="wakescreen-metric-badge active">
                  Attempt: <span className="wakescreen-metric-value">{attempt} / 10</span>
                </div>
                <div className="wakescreen-metric-badge">
                  Elapsed: <span className="wakescreen-metric-value">{elapsedTime}s</span>
                </div>
              </div>

              <p className="wakescreen-info-tip">
                Note: The FastAPI backend is hosted on a sleep-on-idle server (Railway).
                Waking it up from a cold-start usually takes 5 to 30 seconds.
              </p>
            </div>
          </>
        )}

        {/* --- ERROR STATE --- */}
        {isError && (
          <>
            <div className="wakescreen-error-icon">⚠️</div>

            <div className="wakescreen-content">
              <h2 className="wakescreen-title">Connection Timeout</h2>
              <p className="wakescreen-subtitle">
                The server did not respond to connection attempts.
              </p>

              <div className="wakescreen-error-box">
                All 10 attempts failed to wake up the server. The connection process timed out after{" "}
                <strong>{elapsedTime} seconds</strong>.
              </div>

              <div style={{ marginTop: "16px" }}>
                <button className="wakescreen-retry-btn" onClick={retry}>
                  🔄 Retry Connection
                </button>
              </div>

              <p className="wakescreen-info-tip">
                Please check your internet connection or verify the backend service status on Railway, then try again.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
