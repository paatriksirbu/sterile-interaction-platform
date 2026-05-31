import { getSessionId } from './sessionContextService.js';
import { API_BASE_URL } from '../config.js';

const GESTURE_ENDPOINT = API_BASE_URL + '/api/gestures';
const COOLDOWN_MS = 1000;

const GESTURE_MAP = {
  pinch:      'PINCH',
  pointing:   'POINTING',
  closedFist: 'CLOSED_FIST',
  openHand:   'OPEN_HAND',
  lock:       'LOCK_GESTURE',
  spherical:  'SPHERICAL',
};

let _lastSentGesture = null;
let _lastSentTs = 0;

function sendGestureIfConfirmed(gestureState, pageName = 'unknown') {
  if (!gestureState) return;

  const priority = ['pinch', 'pointing', 'closedFist', 'openHand', 'lock', 'spherical'];
  let gestureKey = null;
  for (const key of priority) {
    if (gestureState[key] && gestureState[key].confirmed) {
      gestureKey = key;
      break;
    }
  }

  if (!gestureKey) return;
  const backendType = GESTURE_MAP[gestureKey];
  if (!backendType) return;

  const now = Date.now();
  const sameGesture = _lastSentGesture === backendType;
  const withinCooldown = (now - _lastSentTs) < COOLDOWN_MS;
  if (sameGesture && withinCooldown) return;

  _lastSentGesture = backendType;
  _lastSentTs = now;

  const payload = {
    sessionId: getSessionId(),
    gestureType: backendType,
    confidence: 1.0
  };

  console.log(`[GESTURE_API][${pageName}] Sending gesture:`, JSON.stringify(payload));

  fetch(GESTURE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(res) { console.log(`[GESTURE_API][${pageName}] Response:`, res.status); })
    .catch(function(err) { console.warn('[GESTURE_API] POST failed:', err.message); });
}

export { sendGestureIfConfirmed };
