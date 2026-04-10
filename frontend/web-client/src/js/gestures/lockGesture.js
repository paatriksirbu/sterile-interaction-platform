import { CONFIG } from "../config.js";
import { detectApprovalGesture } from "./approvalGesture.js";

export function detectLockGesture(landmarks) {
  return detectApprovalGesture(landmarks);
}

export function isLockGestureActive(gestureState) {
  if (!gestureState || !CONFIG.INTERACTIONS.LOCK?.ENABLED) return false;

  if (typeof gestureState.anyLock === "boolean") {
    return gestureState.anyLock;
  }

  const handsWithLock = gestureState.handsWithLock || [];
  return handsWithLock.length > 0;
}
