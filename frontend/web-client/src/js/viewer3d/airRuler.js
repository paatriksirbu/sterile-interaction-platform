// src/js/viewer3d/airRuler.js
import * as THREE from "three";

/**
 * AirRuler anclado al modelo:
 * - Convierte A/B (pantalla) -> mundo con Raycaster.intersectObject()
 * - Guarda A/B en LOCAL del modelo (worldToLocal)
 * - Dibuja histórico proyectando local->world->screen (sigue al modelo al mover/rotar/escalar)
 */
export function createAirRuler({ mirror = false } = {}) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  const state = {
    enabled: true,

    // medición actual
    active: false,
    frozen: false,
    ownerKey: "Right",

    // calibración (mm por unidad mundo). Se calcula al iniciar cada medida nueva.
    mmPerWorldUnit: null,
    modelMmReference: 150, // 15cm = 150mm

    // puntos actuales en local del modelo
    localA: null, // Vector3
    localB: null, // Vector3

    // histórico de medidas fijadas
    measurements: [], // [{ id, localA, localB, mmPerWorldUnit }]
    seqId: 1,
  };

  function isActive() {
    return state.active;
  }
  function isFrozen() {
    return state.frozen;
  }
  function setEnabled(v) {
    state.enabled = !!v;
    if (!state.enabled) resetCurrent();
  }

  function resetCurrent() {
    state.active = false;
    state.frozen = false;
    state.mmPerWorldUnit = null;
    state.localA = null;
    state.localB = null;
  }

  function clearAll() {
    resetCurrent();
    state.measurements.length = 0;
    state.seqId = 1;
  }

  // NDC helpers
  function screenToNDC(xPx, yPx, canvasW, canvasH) {
    ndc.x = (xPx / canvasW) * 2 - 1;
    ndc.y = -(yPx / canvasH) * 2 + 1;
    return ndc;
  }

  // Raycast a modelo (patrón estándar) [1](https://threejs.org/docs/pages/Raycaster.html)[2](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/)
  function pickOnModel(xPx, yPx, camera, model, canvasW, canvasH) {
    screenToNDC(xPx, yPx, canvasW, canvasH);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(model, true);
    if (!hits || !hits.length) return null;
    return hits[0].point.clone();
  }

  // world->screen
  function projectWorldToScreen(worldPoint, camera, canvasW, canvasH) {
    tmp.copy(worldPoint).project(camera);
    return {
      xPx: (tmp.x * 0.5 + 0.5) * canvasW,
      yPx: (-tmp.y * 0.5 + 0.5) * canvasH,
    };
  }

  // mm por unidad mundo = 150mm / maxDimWorld (del modelo en ese momento).
  // Si el modelo cambia de escala, maxDimWorld cambia => mmPerWorldUnit cambia en la siguiente medición.
  // Durante una medición ya fijada, el valor mm se recalcula dinámico con local->world (incluye escala).
  function computeMmPerWorldUnit(model, modelMmReference) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDimWorld = Math.max(size.x, size.y, size.z) || 1;
    return modelMmReference / maxDimWorld;
  }

  function startNext({
    ownerKey = "Right",
    model,
    modelMmReference = 150,
  } = {}) {
    state.active = true;
    state.frozen = false;
    state.ownerKey = ownerKey;
    state.modelMmReference = modelMmReference;

    state.mmPerWorldUnit = model
      ? computeMmPerWorldUnit(model, modelMmReference)
      : null;
    state.localA = null;
    state.localB = null;
  }

  function updateLiveFromScreen({
    handKey,
    AxPx,
    AyPx,
    BxPx,
    ByPx,
    canvasW,
    canvasH,
    camera,
    model,
  }) {
    if (!state.enabled || !state.active || state.frozen) return false;
    if (handKey && handKey !== state.ownerKey) return true;
    if (!camera || !model) return false;

    const wA = pickOnModel(AxPx, AyPx, camera, model, canvasW, canvasH);
    const wB = pickOnModel(BxPx, ByPx, camera, model, canvasW, canvasH);
    if (!wA || !wB) return false;

    // guardamos en local del modelo (clave para “seguir” al modelo)
    state.localA = model.worldToLocal(wA.clone());
    state.localB = model.worldToLocal(wB.clone());

    return true;
  }

  function freeze() {
    if (!state.active || state.frozen) return;
    if (!state.localA || !state.localB || state.mmPerWorldUnit == null) return;

    state.measurements.push({
      id: state.seqId++,
      localA: state.localA.clone(),
      localB: state.localB.clone(),
      mmPerWorldUnit: state.mmPerWorldUnit,
    });

    // terminamos medición actual pero mantenemos histórico
    resetCurrent();
  }

  function drawOverlay(ctx, { camera, model, canvasW, canvasH } = {}) {
    if (!state.enabled || !ctx || !camera || !model || !canvasW || !canvasH)
      return;

    // histórico
    for (const m of state.measurements) {
      drawOne(ctx, m, { camera, model, canvasW, canvasH }, true, false);
    }

    // live
    if (
      state.active &&
      state.localA &&
      state.localB &&
      state.mmPerWorldUnit != null
    ) {
      const live = {
        id: "LIVE",
        localA: state.localA,
        localB: state.localB,
        mmPerWorldUnit: state.mmPerWorldUnit,
      };
      drawOne(ctx, live, { camera, model, canvasW, canvasH }, false, true);
    }
  }

  function drawOne(ctx, m, { camera, model, canvasW, canvasH }, faded, live) {
    const wA = model.localToWorld(m.localA.clone());
    const wB = model.localToWorld(m.localB.clone());

    const A = projectWorldToScreen(wA, camera, canvasW, canvasH);
    const B = projectWorldToScreen(wB, camera, canvasW, canvasH);

    // distancia dinámica: si el modelo escala, wA-wB cambia => mm cambia.
    const distWorld = wA.distanceTo(wB);
    const mm = distWorld * m.mmPerWorldUnit;

    const midX = (A.xPx + B.xPx) * 0.5;
    const midY = (A.yPx + B.yPx) * 0.5;

    ctx.save();
    ctx.globalAlpha = faded ? 0.75 : 1.0;

    ctx.lineWidth = 3;
    ctx.strokeStyle = faded ? "rgba(46,168,255,0.55)" : "rgba(46,168,255,0.95)";
    ctx.shadowColor = faded ? "rgba(46,168,255,0.20)" : "rgba(46,168,255,0.60)";
    ctx.shadowBlur = faded ? 6 : 12;

    ctx.beginPath();
    ctx.moveTo(A.xPx, A.yPx);
    ctx.lineTo(B.xPx, B.yPx);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(A.xPx, A.yPx, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(B.xPx, B.yPx, 4, 0, Math.PI * 2);
    ctx.fill();

    const label = live
      ? `LIVE  ${mm.toFixed(1)} mm`
      : `#${m.id}  ${mm.toFixed(1)} mm`;

    ctx.font = "600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const pad = 7;
    const textW = ctx.measureText(label).width;
    const boxW = textW + pad * 2;
    const boxH = 24;

    const bx = midX - boxW / 2;
    const by = midY - boxH - 10;

    ctx.fillStyle = "rgba(9,16,22,0.72)";
    ctx.strokeStyle = "rgba(46,168,255,0.55)";
    ctx.lineWidth = 1.3;

    roundRect(ctx, bx, by, boxW, boxH, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(label, bx + pad, by + 16);

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  return {
    state,
    setEnabled,
    isActive,
    isFrozen,
    startNext,
    updateLiveFromScreen,
    freeze,
    clearAll,
    drawOverlay,
  };
}
