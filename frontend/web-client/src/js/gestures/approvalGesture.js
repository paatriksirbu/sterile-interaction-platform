import { getLandmarks, getHandSize } from "./base.js";
import { distance2D, distance3D } from "../utils/math.js";

export function detectApprovalGesture(landmarks) {
  const l = getLandmarks(landmarks);
  if (!l) return false;

  const handSize = getHandSize(landmarks);

  const thumbToWrist = distance3D(l.thumbTip, l.wrist);
  const thumbMCPToWrist = distance3D(l.thumbMCP, l.wrist);
  const thumbExtended = thumbToWrist > thumbMCPToWrist * 1.1;

  const thumbAboveMCP = l.thumbTip.y < l.thumbMCP.y;

  const indexCurled =
    distance2D(l.indexTip, l.wrist) < distance2D(l.indexMCP, l.wrist) * 1.1;
  const middleCurled =
    distance2D(l.middleTip, l.wrist) < distance2D(l.middleMCP, l.wrist) * 1.1;
  const ringCurled =
    distance2D(l.ringTip, l.wrist) < distance2D(l.ringMCP, l.wrist) * 1.1;
  const pinkyCurled =
    distance2D(l.pinkyTip, l.wrist) < distance2D(l.pinkyMCP, l.wrist) * 1.1;

  const curledCount = [
    indexCurled,
    middleCurled,
    ringCurled,
    pinkyCurled,
  ].filter(Boolean).length;
  const fingersCurled = curledCount >= 3;

  const thumbToIndex = distance3D(l.thumbTip, l.indexTip);
  const notPinching = thumbToIndex > handSize * 0.15;

  const avgFingerTipY =
    (l.indexTip.y + l.middleTip.y + l.ringTip.y + l.pinkyTip.y) / 4;
  const thumbHigherThanFingers = l.thumbTip.y < avgFingerTipY - handSize * 0.05;

  const result =
    thumbExtended &&
    thumbAboveMCP &&
    fingersCurled &&
    notPinching &&
    thumbHigherThanFingers;

  return result;
}
