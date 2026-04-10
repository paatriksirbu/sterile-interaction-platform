import { CONFIG } from "../config.js";
import { loadNumberFromStorage } from "../utils/storage.js";

/**
 * Clase que maneja el estado global de la aplicación
 */
class AppState {
  constructor() {
    // Canvas y contexto
    this.canvas = null;
    this.ctx = null;
    this.videoElement = null;

    // Zoom global controlado por gesto pinch (rawDistance)
    this.currentZoom = 1.0;
    this.lastPinchDistance = null;

    // === Estados legacy de interacción (cuadrados) — mantenidos por compatibilidad ===
    this.pinchWasActive = false;
    this.pinchDragging = false;
    this.pinchOffsetNorm = { dx: 0, dy: 0 };

    this.sphericalWasActive = false;
    this.sphericalDragging = false;
    this.sphericalOffsetNorm = { dx: 0, dy: 0 };

    this.ringTouchWasActive = false;

    // ID del cuadrado activo (legacy)
    this.activeSquareId = null;

    // === NUEVO: Estado del PDF (sustituye al cuadrado en la interacción) ===
    this.pdf = {
      center: { x: 0.5, y: 0.5 }, // centro en coordenadas normalizadas (0..1)
      dragging: false, // si está siendo arrastrado con pinch
      wasActive: false, // flag auxiliar (si lo necesitas)
      offsetNorm: { dx: 0, dy: 0 }, // desplazamiento pinch→centro (normalizado)
    };

    // Elementos DOM (legacy - algunos ya no se usan)
    this.valuesElement = null;
    this.legendElement = null;

    // Dentro del constructor() de AppState
    this.pager = {
      lastClickTs: 0, // anti-doble click por mantener el pinch
      hoverId: null, // id del botón que estamos “apuntando”
    };
  }

  /**
   * Inicializa el estado con referencias del DOM
   * @param {HTMLCanvasElement} canvas - Canvas principal
   * @param {CanvasRenderingContext2D} ctx - Contexto 2D
   * @param {HTMLVideoElement} videoElement - Elemento de video
   */
  init(canvas, ctx, videoElement) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.videoElement = videoElement;

    // Obtener elementos del DOM (legacy - algunos ya no se usan)
    this.valuesElement = document.getElementById("values");
    this.legendElement = document.getElementById("legend");

    console.log("✅ Estado de la aplicación inicializado");
  }

  /**
   * Resetea los estados de interacción
   */
  resetInteractionStates() {
    // Legacy (cuadrados)
    this.pinchDragging = false;
    this.sphericalDragging = false;
    this.activeSquareId = null;

    // PDF
    this.pdf.dragging = false;
    this.pdf.wasActive = false;
  }

  /**
   * Actualiza el zoom basado en la distancia del pinch
   * @param {number} pinchDistance - Distancia normalizada del pinch (rawDistance)
   */
  updateZoom(pinchDistance) {
    if (this.lastPinchDistance === null) {
      this.lastPinchDistance = pinchDistance;
      return;
    }

    const delta = pinchDistance - this.lastPinchDistance;
    this.currentZoom += delta * CONFIG.ZOOM.SENSITIVITY;
    this.currentZoom = Math.max(
      CONFIG.ZOOM.MIN,
      Math.min(CONFIG.ZOOM.MAX, this.currentZoom),
    );
    this.lastPinchDistance = pinchDistance;
  }

  /**
   * Resetea el zoom (mantiene el nivel actual, pero borra la referencia para el siguiente delta)
   */
  resetZoom() {
    this.lastPinchDistance = null;
  }

  /**
   * Obtiene información del estado actual para debugging
   * @returns {Object} Estado actual
   */
  getDebugInfo() {
    return {
      zoom: this.currentZoom,
      pinchDragging: this.pinchDragging,
      sphericalDragging: this.sphericalDragging,
      activeSquare: this.activeSquareId, // legacy
      pdf: {
        center: this.pdf.center,
        dragging: this.pdf.dragging,
      },
      canvasSize: {
        width: this.canvas?.width,
        height: this.canvas?.height,
      },
    };
  }
}

// Exportar instancia singleton
export const appState = new AppState();

// También exportar la clase
export { AppState };
