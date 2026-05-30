const SESSION_KEY = 'surgical_session_id';

function generateSessionId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `surgical-session-${ts}-${rand}`;
}

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    console.log('[SESSION] New sessionId generated:', id);
  }
  return id;
}

export { getSessionId };

console.log('[SESSION] Active sessionId:', getSessionId());
