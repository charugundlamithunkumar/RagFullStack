// One session_id per browser session, held in memory only -- matches
// the backend's in-memory session_store (both are lost on
// reload/restart, the same tradeoff Streamlit's st.session_state
// already had).
let sessionId: string | null = null;

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  if (!sessionId) {
    const stored = window.sessionStorage.getItem("mmrag_session_id");
    sessionId = stored ?? crypto.randomUUID();
    window.sessionStorage.setItem("mmrag_session_id", sessionId);
  }
  return sessionId;
}
