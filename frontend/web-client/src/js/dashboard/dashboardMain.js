import { initMediaPipe } from "../utils/mediapipeSetup.js";
import { gestureDetector } from "../gestures/detector.js";
import { processDashboardGestures } from "./dashboard_gestures.js";
import { sendGestureIfConfirmed } from "../services/gestureApiService.js";

import { applyMirror, clearCanvas } from "../utils/canvas.js";
import { drawAllHands } from "../rendering/hands.js";
import { drawPinchGesture } from "../rendering/gestures.js";
import {
  updateHandTrackingHUD,
  processGestureFeedback,
} from "../rendering/handTrackingHUD.js";

const videoElement = document.querySelector(".input_video");

const overlay = document.getElementById("hand-overlay");
const ctx = overlay.getContext("2d");

const sketchCanvas = document.getElementById("gestureSketch");
const sketchCtx = sketchCanvas.getContext("2d");

// Configurar canvas para alta resolucion y aplicar espejo
function setupSketchCanvasDPR() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = 240;
  const cssH = 150;

  sketchCanvas.style.width = cssW + "px";
  sketchCanvas.style.height = cssH + "px";

  sketchCanvas.width = Math.round(cssW * dpr);
  sketchCanvas.height = Math.round(cssH * dpr);

  sketchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyMirror(sketchCtx, sketchCanvas, true);
}

setupSketchCanvasDPR();
window.addEventListener("resize", setupSketchCanvasDPR);

function updateCurrentTime() {
  const timerEl = document.getElementById("current-time");
  if (timerEl) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    timerEl.textContent = `${hh}:${mm}:${ss}`;
  }
}

updateCurrentTime();
setInterval(updateCurrentTime, 1000);

/* ============================================================
    VITALES FLUCTUANTES
    ============================================================ */

const vitals = {
  hr: 72,
  spo2: 98,
  systolic: 120,
  diastolic: 80,
  temp: 36.8,
};

// Rangos normales
const VITAL_RANGES = {
  hr: { min: 62, max: 88, variance: 3 },
  spo2: { min: 96, max: 100, variance: 1 },
  systolic: { min: 112, max: 128, variance: 4 },
  diastolic: { min: 72, max: 88, variance: 3 },
  temp: { min: 36.3, max: 37.1, variance: 0.15 },
};

// Genera un nuevo valor que fluctua dentro de un rango establecido
function fluctuateValue(current, range) {
  const change = (Math.random() - 0.5) * 2 * range.variance;
  let newValue = current + change;
  newValue = Math.max(range.min, Math.min(range.max, newValue));
  return newValue;
}

function updateVitalsDisplay() {
  vitals.hr = Math.round(fluctuateValue(vitals.hr, VITAL_RANGES.hr));
  vitals.spo2 = Math.round(fluctuateValue(vitals.spo2, VITAL_RANGES.spo2));
  vitals.systolic = Math.round(
    fluctuateValue(vitals.systolic, VITAL_RANGES.systolic),
  );
  vitals.diastolic = Math.round(
    fluctuateValue(vitals.diastolic, VITAL_RANGES.diastolic),
  );
  vitals.temp =
    Math.round(fluctuateValue(vitals.temp, VITAL_RANGES.temp) * 10) / 10;

  // Actualizar Heart Rate
  const hrEl = document.querySelector(".vital-line .value.hr");
  if (hrEl) {
    hrEl.textContent = `${vitals.hr} BPM`;
  }

  // Actualizar mini-vitals
  const miniVitals = document.querySelectorAll(".mini-vitals > div");
  if (miniVitals.length >= 3) {
    miniVitals[0].innerHTML = `<b>SpO2</b><br>${vitals.spo2}%`;
    miniVitals[1].innerHTML = `<b>BP</b><br>${vitals.systolic}/${vitals.diastolic}`;
    miniVitals[2].innerHTML = `<b>TEMP</b><br>${vitals.temp.toFixed(1)}ºC`;
  }
}

setInterval(updateVitalsDisplay, 1500);

// Grafico ECG
const miniGraphCanvas = document.getElementById("miniGraph");
const miniGraphCtx = miniGraphCanvas?.getContext("2d");

// Buffer de puntos ECG
const ecgBuffer = [];
const ECG_MAX_POINTS = 120;

// Patrón simplificado de onda ECG (PQRST)
const ECG_PATTERN = [
  0, 0, 0.1, 0, 0, -0.1, 0.8, -0.3, 0.1, 0.2, 0.15, 0.1, 0, 0, 0,
];

let ecgPatternIndex = 0;
let ecgBaselineNoise = 0;

function generateECGPoint() {
  ecgBaselineNoise += (Math.random() - 0.5) * 0.02;
  ecgBaselineNoise *= 0.95;

  const patternValue = ECG_PATTERN[ecgPatternIndex];
  ecgPatternIndex = (ecgPatternIndex + 1) % ECG_PATTERN.length;

  const hrFactor = vitals.hr / 72;
  const noise = (Math.random() - 0.5) * 0.05;

  return patternValue * hrFactor + ecgBaselineNoise + noise;
}

function drawMiniGraph() {
  if (!miniGraphCtx || !miniGraphCanvas) return;

  const w = miniGraphCanvas.width;
  const h = miniGraphCanvas.height;
  const midY = h / 2;

  // Limpiar
  miniGraphCtx.fillStyle = "#1a1f2e";
  miniGraphCtx.fillRect(0, 0, w, h);

  // Añadir nuevo punto
  ecgBuffer.push(generateECGPoint());
  if (ecgBuffer.length > ECG_MAX_POINTS) {
    ecgBuffer.shift();
  }

  // Dibujar línea ECG
  miniGraphCtx.strokeStyle = "#00ff88";
  miniGraphCtx.lineWidth = 1.5;
  miniGraphCtx.beginPath();

  for (let i = 0; i < ecgBuffer.length; i++) {
    const x = (i / ECG_MAX_POINTS) * w;
    const y = midY - ecgBuffer[i] * (h * 0.4);

    if (i === 0) {
      miniGraphCtx.moveTo(x, y);
    } else {
      miniGraphCtx.lineTo(x, y);
    }
  }

  miniGraphCtx.stroke();

  miniGraphCtx.strokeStyle = "rgba(255,255,255,0.1)";
  miniGraphCtx.lineWidth = 0.5;
  miniGraphCtx.beginPath();
  miniGraphCtx.moveTo(0, midY);
  miniGraphCtx.lineTo(w, midY);
  miniGraphCtx.stroke();
}

// Actualizar gráfico ECG ~20fps
if (miniGraphCanvas) {
  setInterval(drawMiniGraph, 50);
}

function onResults(results) {
  const hands = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  clearCanvas(sketchCtx, sketchCanvas);
  drawAllHands(sketchCtx, hands, handedness, sketchCanvas);

  if (hands.length) {
    // Pasar handedness para usar confianza en la priorización de manos
    const gestureState = gestureDetector.detectAll(hands, handedness);
    sendGestureIfConfirmed(gestureState, 'dashboard');

    // Update hand tracking HUD visualization
    updateHandTrackingHUD(hands, handedness, gestureState);

    // Process gesture feedback badges
    processGestureFeedback(gestureState);

    // Resaltar pinch en verde en el panel
    hands.forEach((lm, i) => {
      if (gestureState?.hands?.[i]?.pinch?.detected) {
        drawPinchGesture(sketchCtx, lm, sketchCanvas);
      }
    });

    processDashboardGestures(hands, gestureState);
  } else {
    processDashboardGestures([], null);
    updateHandTrackingHUD([], [], null);
  }
}

initMediaPipe(videoElement, onResults);

console.log("✅ Dashboard MediaPipe inicializado");
