/**
 * Estado local compartido para interacciones por zonas.
 * Centraliza todas las variables de estado de interacción.
 */
import { CONFIG } from "../config.js";

/* ============================================================
    CONSTANTES DERIVADAS DE CONFIG
    ============================================================ */
export const OPENHAND_SCROLL_STEP_PX =
  CONFIG.INTERACTIONS.OPENHAND.SCROLL_STEP_PX;
export const OPENHAND_SCROLL_COOLDOWN_MS =
  CONFIG.INTERACTIONS.OPENHAND.SCROLL_COOLDOWN_MS;
export const CLOSED_FIST_COOLDOWN_MS = 1000;
export const CANVAS_ANN_PANEL_COOLDOWN_MS = 400;

/* ============================================================
    ESTADO DE INTERACCIÓN
    ============================================================ */

// Objeto de estado - permite modificar desde cualquier módulo
export const interactionState = {
  // Para evitar conflictos entre zonas
  activeDragContext: null,

  // Flag para bloquear arrastre del PDF en el frame actual
  blockPdfDragThisFrame: false,

  // Timestamp del último cambio de página (para bloquear drag del PDF)
  lastPageChangeTs: 0,

  // ---- UI PINCH CLICK ----
  prevUiPinchActive: false,
  dwellTargetId: null,
  dwellStartTs: 0,

  // ---- PAGER (columna derecha) ----
  prevPagerPinchActive: false,
  lastPagerClickTs: 0,
  pagerScrollAccumY: 0,
  lastPinchClientYPager: null,
  lastPagerScrollTs: 0,

  // ---- INFO (columna izquierda) ----
  prevInfoPinchActive: false,
  lastPinchClientYInfo: null,

  // ---- OPEN HAND (scroll por palma abierta) ----
  prevOpenHandActive: false,
  lastOpenHandClientY: null,
  openHandScrollAccumY: 0,
  lastOpenHandScrollTs: 0,
  openHandRequireRelease: false,
  openHandLastDir: 0, // -1 abajo, 1 arriba, 0 sin movimiento

  // ---- ZOOM ----
  zoomActive: false,
  zoomInitialDistance: null,
  zoomInitialLevelIndex: null,
  lastZoomChangeTs: 0,

  // ---- ANOTACIONES con pointing ----
  annotationDwellPos: null,
  annotationDwellStartTs: 0,
  annotationDwellPdfCoords: null,
  prevPointingActive: false,

  // ---- CLOSED FIST (puño cerrado) ----
  prevClosedFistConfirmed: false,
  lastClosedFistToggleTs: 0,
  // Sistema de histéresis para evitar falsos toggles al mover el puño
  lastClosedFistDetectedTs: 0, // Timestamp de última detección
  closedFistHysteresisMs: 300, // Tiempo mínimo sin detectar para considerar "gesto terminado"
  closedFistActiveSession: false, // Si estamos en una "sesión" activa de closed fist

  // ---- GLOBAL LOCK MODE ----
  lockActive: false,
  lockGestureStartTs: null, // Timestamp de inicio del gesto de lock en el frame actual
  lockLastGestureActive: false, // Estado del gesto de lock
  lastLockToggleTs: 0, // Última vez del toggle

  // ---- PANEL DE ANOTACIONES EN CANVAS ----
  canvasAnnPanelHover: null,
  canvasAnnPanelLastClick: 0,
  prevCanvasAnnPinchActive: false,
};

/**
 * Resetea el flag de bloqueo de PDF para el siguiente frame.
 * Debe llamarse al final de cada frame.
 */
export function resetFrameFlags() {
  interactionState.blockPdfDragThisFrame = false;
}
