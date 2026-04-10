import { CONFIG } from "../config.js";
import { pdfManager } from "./pdfManager.js";

// Tipos de anotación (chinchetas)
export const ANNOTATION_TYPES = {
  REFERENCE: {
    id: "reference",
    color: "#4CAF50", // Verde - punto de referencia
    icon: "📍",
    label: "Reference",
  },
  CAUTION: {
    id: "caution",
    color: "#FF5722", // Rojo - advertencia
    icon: "⚠️",
    label: "Caution",
  },
  NOTE: {
    id: "note",
    color: "#FFC107", // Amarillo - Nota
    icon: "📝",
    label: "Note",
  },
  INCISION: {
    id: "incision",
    color: "#2196F3", // Azul - punto de incisión
    icon: "🔹",
    label: "Incision",
  },
};

// Manager para gestionar marcas en el documento
class AnnotationManager {
  constructor() {
    // Map de anotaciones por página: pageNum -> [annotations]
    this.annotationsByPage = new Map();

    // Tipo de anotación actualmente seleccionado
    this.currentType = ANNOTATION_TYPES.REFERENCE;

    // ID incremental para anotaciones
    this._nextId = 1;

    // Listeners para actualización de UI
    this._listeners = [];
  }

  // Obtiene las anotaciones de la página actual del PDF
  getCurrentPageAnnotations() {
    const pageNum = pdfManager?.pageNum || 1;
    return this.annotationsByPage.get(pageNum) || [];
  }

  // Obtiene todas las anotaciones de una página específica
  getPageAnnotations(pageNum) {
    return this.annotationsByPage.get(pageNum) || [];
  }

  // Añade una nueva anotación en la posición indicada
  addAnnotation(x, y, type = null, label = "", speechText = "") {
    const pageNum = pdfManager?.pageNum || 1;
    const annotationType = type || this.currentType;

    const annotation = {
      id: this._nextId++,
      pageNum,
      x, // Normalizado 0-1 relativo al PDF
      y, // Normalizado 0-1 relativo al PDF
      type: annotationType,
      label: label || `${annotationType.label} ${this._nextId - 1}`,
      speechText: speechText, // Texto transcrito de voz
      isRecording: false, // Estado de grabación
      timestamp: Date.now(),
    };

    if (!this.annotationsByPage.has(pageNum)) {
      this.annotationsByPage.set(pageNum, []);
    }
    this.annotationsByPage.get(pageNum).push(annotation);

    this._notifyListeners("add", annotation);
    console.log(
      `📍 Annotation added: ${annotation.label} at page ${pageNum} (${x.toFixed(3)}, ${y.toFixed(3)})`,
    );

    return annotation;
  }

  // Elimina anotación por ID
  removeAnnotation(id) {
    for (const [pageNum, annotations] of this.annotationsByPage) {
      const idx = annotations.findIndex((a) => a.id === id);
      if (idx !== -1) {
        const removed = annotations.splice(idx, 1)[0];
        this._notifyListeners("remove", removed);
        console.log(`📍 Annotation removed: ${removed.label}`);
        return true;
      }
    }
    return false;
  }

  // Elimina todas las anotaciones de la página actual
  clearCurrentPage() {
    const pageNum = pdfManager?.pageNum || 1;
    const removed = this.annotationsByPage.get(pageNum) || [];
    this.annotationsByPage.set(pageNum, []);
    this._notifyListeners("clear", { pageNum, count: removed.length });
    console.log(
      `📍 Cleared ${removed.length} annotations from page ${pageNum}`,
    );
  }

  // Elimina todas las anotaciones
  clearAll() {
    const totalCount = this.getTotalCount();
    this.annotationsByPage.clear();
    this._notifyListeners("clearAll", { count: totalCount });
    console.log(`📍 Cleared all ${totalCount} annotations`);
  }

  // Cambia el tipo de anotación activo
  setCurrentType(typeId) {
    const type = Object.values(ANNOTATION_TYPES).find((t) => t.id === typeId);
    if (type) {
      this.currentType = type;
      this._notifyListeners("typeChange", type);
    }
  }

  // Cicla al siguiente tipo de anotación
  cycleType() {
    const types = Object.values(ANNOTATION_TYPES);
    const currentIdx = types.findIndex((t) => t.id === this.currentType.id);
    const nextIdx = (currentIdx + 1) % types.length;
    this.currentType = types[nextIdx];
    this._notifyListeners("typeChange", this.currentType);
    return this.currentType;
  }

  // Actualiza el texto de voz de una anotación
  updateSpeechText(annotationId, speechText) {
    for (const [pageNum, annotations] of this.annotationsByPage) {
      const ann = annotations.find((a) => a.id === annotationId);
      if (ann) {
        ann.speechText = speechText;
        ann.isRecording = false;
        this._notifyListeners("speechUpdate", ann);
        console.log(`📍 Speech text updated for ${ann.label}: "${speechText}"`);
        return true;
      }
    }
    return false;
  }

  // Marca una anotación como "grabando"
  setRecordingState(annotationId, isRecording) {
    for (const [pageNum, annotations] of this.annotationsByPage) {
      const ann = annotations.find((a) => a.id === annotationId);
      if (ann) {
        ann.isRecording = isRecording;
        this._notifyListeners("recordingState", {
          annotation: ann,
          isRecording,
        });
        return true;
      }
    }
    return false;
  }

  // Obtiene una anotación por ID
  getAnnotationById(id) {
    for (const [pageNum, annotations] of this.annotationsByPage) {
      const ann = annotations.find((a) => a.id === id);
      if (ann) return ann;
    }
    return null;
  }

  // Obtiene el número total de anotaciones en todas las páginas
  getTotalCount() {
    let count = 0;
    for (const annotations of this.annotationsByPage.values()) {
      count += annotations.length;
    }
    return count;
  }

  // Encuentra la anotación más cercana a un punto (para hit-testing/eliminación)
  findNearestAnnotation(x, y, threshold = 0.05) {
    const annotations = this.getCurrentPageAnnotations();
    let nearest = null;
    let minDist = threshold;

    for (const ann of annotations) {
      const dx = ann.x - x;
      const dy = ann.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = ann;
      }
    }
    return nearest;
  }

  // Registra un listener para cambios
  addListener(callback) {
    this._listeners.push(callback);
  }

  // Elimina un listener
  removeListener(callback) {
    const idx = this._listeners.indexOf(callback);
    if (idx !== -1) this._listeners.splice(idx, 1);
  }

  _notifyListeners(event, data) {
    for (const listener of this._listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error("Annotation listener error:", e);
      }
    }
  }

  // Renderiza las anotaciones de la página actual sobre el canvas
  render(ctx, canvas) {
    const annotations = this.getCurrentPageAnnotations();
    if (annotations.length === 0) return;

    const cfg = CONFIG.ANNOTATIONS || {};
    const pinSize = cfg.PIN_SIZE || 24;
    const labelOffset = cfg.LABEL_OFFSET || 28;

    for (const ann of annotations) {
      // Convertir coordenadas relativas al PDF a coordenadas del canvas
      const pos = this._annotationToCanvas(ann, canvas);
      if (!pos) continue;

      const { x, y } = pos;

      // Dibujar chincheta (pin)
      ctx.save();

      // Sombra
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Pin stem (línea vertical)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - pinSize * 0.6);
      ctx.strokeStyle = ann.type.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pin head (círculo)
      ctx.beginPath();
      ctx.arc(
        x,
        y - pinSize * 0.6 - pinSize * 0.35,
        pinSize * 0.35,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = ann.type.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Etiqueta (si está habilitada)
      if (cfg.SHOW_LABELS !== false) {
        ctx.save();
        const fontSize = cfg.LABEL_FONT_SIZE || 12;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = ann.type.color;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        const labelY = y - labelOffset - pinSize * 0.5;
        ctx.strokeText(ann.label, x, labelY);
        ctx.fillText(ann.label, x, labelY);
        ctx.restore();

        // Texto de voz (si existe)
        if (ann.speechText) {
          this._renderSpeechBubble(
            ctx,
            x,
            y,
            ann.speechText,
            ann.type.color,
            cfg,
          );
        }

        // Indicador de grabación
        if (ann.isRecording) {
          this._renderRecordingIndicator(ctx, x, y - pinSize - 10);
        }
      }
    }
  }

  /**
   * Renderiza una burbuja de texto junto a la anotación
   */
  _renderSpeechBubble(ctx, x, y, text, color, cfg) {
    const maxWidth = cfg.MAX_TEXT_WIDTH || 200;
    const fontSize = 11;
    const padding = 8;
    const lineHeight = fontSize + 4;
    const bubbleY = y + 20; // Debajo del pin

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;

    // Dividir texto en líneas
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limitar a 4 líneas máximo
    const displayLines = lines.slice(0, 4);
    if (lines.length > 4) {
      displayLines[3] = displayLines[3].slice(0, -3) + "...";
    }

    // Calcular dimensiones de la burbuja
    const bubbleWidth = Math.min(
      maxWidth,
      Math.max(...displayLines.map((l) => ctx.measureText(l).width)) +
        padding * 2,
    );
    const bubbleHeight = displayLines.length * lineHeight + padding * 2;
    const bubbleX = x - bubbleWidth / 2;

    // Sombra
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Fondo de la burbuja
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
    ctx.fillStyle = "rgba(20, 25, 35, 0.92)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowColor = "transparent";

    // Flecha hacia arriba
    ctx.beginPath();
    ctx.moveTo(x - 6, bubbleY);
    ctx.lineTo(x, bubbleY - 8);
    ctx.lineTo(x + 6, bubbleY);
    ctx.fillStyle = "rgba(20, 25, 35, 0.92)";
    ctx.fill();

    // Texto
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    displayLines.forEach((line, i) => {
      ctx.fillText(
        line,
        bubbleX + padding,
        bubbleY + padding + fontSize + i * lineHeight,
      );
    });

    ctx.restore();
  }

  /**
   * Renderiza el indicador de grabación (círculo rojo pulsante)
   */
  _renderRecordingIndicator(ctx, x, y) {
    const time = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(time / 150); // Pulso rápido

    ctx.save();

    // Círculo exterior (glow)
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 68, 68, ${0.2 + pulse * 0.2})`;
    ctx.fill();

    // Círculo rojo
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4444";
    ctx.fill();

    // Icono de micrófono (simplificado)
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎙", x, y);

    ctx.restore();
  }

  // Convierte las coordenadas de una anotación (relativas al PDF) a coordenadas del canvas
  _annotationToCanvas(ann, canvas) {
    if (!pdfManager || !pdfManager.page) return null;

    const displayScale = pdfManager.scale * (window.appState?.currentZoom || 1);
    const drawW = pdfManager.basePx.width * displayScale;
    const drawH = pdfManager.basePx.height * displayScale;

    // Centro del PDF en píxeles
    const cpx = {
      x: pdfManager.center.x * canvas.width,
      y: pdfManager.center.y * canvas.height,
    };

    // Esquina superior izquierda del PDF
    const pdfLeft = cpx.x - drawW / 2;
    const pdfTop = cpx.y - drawH / 2;

    // Posición de la anotación en el canvas
    return {
      x: pdfLeft + ann.x * drawW,
      y: pdfTop + ann.y * drawH,
    };
  }

  /**
   * Convierte coordenadas del canvas (px) a coordenadas relativas al PDF (0-1)
   */
  canvasToPdfCoords(canvasX, canvasY, canvas) {
    if (!pdfManager || !pdfManager.page) return null;

    const displayScale = pdfManager.scale * (window.appState?.currentZoom || 1);
    const drawW = pdfManager.basePx.width * displayScale;
    const drawH = pdfManager.basePx.height * displayScale;

    // Centro del PDF en píxeles
    const cpx = {
      x: pdfManager.center.x * canvas.width,
      y: pdfManager.center.y * canvas.height,
    };

    // Esquina superior izquierda del PDF
    const pdfLeft = cpx.x - drawW / 2;
    const pdfTop = cpx.y - drawH / 2;

    // Verificar si está dentro del PDF
    if (
      canvasX < pdfLeft ||
      canvasX > pdfLeft + drawW ||
      canvasY < pdfTop ||
      canvasY > pdfTop + drawH
    ) {
      return null;
    }

    // Coordenadas relativas al PDF (0-1)
    return {
      x: (canvasX - pdfLeft) / drawW,
      y: (canvasY - pdfTop) / drawH,
    };
  }
}

// Exportar instancia singleton
export const annotationManager = new AnnotationManager();
