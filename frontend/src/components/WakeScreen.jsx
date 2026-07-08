export default function WakeScreen({
  status,
  elapsedTime,
  attempt,
  retry,
  fadeOut,
}) {
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
                  Attempt:{" "}
                  <span className="wakescreen-metric-value">
                    {attempt} / 10
                  </span>
                </div>
                <div className="wakescreen-metric-badge">
                  Elapsed:{" "}
                  <span className="wakescreen-metric-value">
                    {elapsedTime}s
                  </span>
                </div>
              </div>

              <p className="wakescreen-info-tip">
                Note: The AI server may take 5–30 seconds to start if it has
                been idle. Thank you for your patience.
              </p>
            </div>
          </>
        )}

        {/* --- ERROR STATE --- */}
        {isError && (
          <>
            <div className="wakescreen-error-icon">⚠️</div>

            <div className="wakescreen-content">
              <h2 className="wakescreen-title">Unable to Connect</h2>
              <p className="wakescreen-subtitle">
                The AI service is currently unavailable.
              </p>

              <div className="wakescreen-error-box">
                We couldn't establish a connection after multiple attempts. The
                connection process timed out after{" "}
                <strong>{elapsedTime} seconds</strong>.
              </div>

              <div style={{ marginTop: "16px" }}>
                <button className="wakescreen-retry-btn" onClick={retry}>
                  Retry Connection
                </button>
              </div>

              <p className="wakescreen-info-tip">
                If the issue persists, please try again later.Or you can also
                explore the project on GitHub while the service is unavailable.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
