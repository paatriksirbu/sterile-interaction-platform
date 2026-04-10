// src/js/objects/pdfManager.js
import { normToPx } from "../utils/transforms.js";
import { clamp } from "../utils/math.js";
import { appState } from "../state/state.js";

class PdfManager {
  constructor() {
    this.pdfDoc = null;
    this.page = null;
    this.pageNum = 1;

    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d");

    this.basePx = { width: 0, height: 0 };
    this.center = { x: 0.5, y: 0.5 };
    this.scale = 1;

    this._lastTextureScale = 0;
    // Sigue la referencia al renderTask actual para poder cancelarlo si es necesario
    this._renderTask = null;
    // Sigue la referencia al renderTask actual para poder cancelarlo si es necesario
    this._renderTask = null;
  }

  get pageCount() {
    return this.pdfDoc?.numPages ?? 0;
  }

  async load(url) {
    const pdfjsLib = window["pdfjsLib"];
    if (!pdfjsLib) {
      console.error(
        "❌ PDF.js no está disponible (window.pdfjsLib no encontrado).",
      );
      return;
    }
    try {
      this.pdfDoc = await pdfjsLib.getDocument(url).promise;
    } catch (err) {
      console.error("❌ Error fetching PDF document:", err);
      throw err;
    }
    this.pageNum = clamp(this.pageNum, 1, this.pdfDoc.numPages);
    this.page = await this.pdfDoc.getPage(this.pageNum);
    await this._renderTexture(1);
    console.log(
      `✅ PDF cargado: ${url} (pág. ${this.pageNum}/${this.pdfDoc.numPages})`,
    );
  }

  async _renderTexture(textureScale) {
    if (!this.page) return;
    const viewport = this.page.getViewport({ scale: textureScale });
    this.offscreen.width = Math.max(1, Math.floor(viewport.width));
    this.offscreen.height = Math.max(1, Math.floor(viewport.height));
    this.basePx.width = this.offscreen.width;
    this.basePx.height = this.offscreen.height;
    this.offctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    // If there is an existing render task using the same canvas, cancel it first to avoid
    // the pdf.js "Cannot use the same canvas during multiple render() operations" error.
    try {
      if (this._renderTask && typeof this._renderTask.cancel === "function") {
        // cancel previous render; ignore errors
        this._renderTask.cancel();
      }
    } catch (err) {
      console.error("Error canceling previous render:", err);
    }

    // Start a new render task and keep a reference to it so future calls can cancel it.
    const renderTask = this.page.render({
      canvasContext: this.offctx,
      viewport,
    });
    this._renderTask = renderTask;
    try {
      try {
        await renderTask.promise;
        this._lastTextureScale = textureScale;
      } catch (err) {
        if (err && err.name === "RenderingCancelledException") {
          // expected cancellation, ignore
        } else {
          throw err;
        }
      }
    } finally {
      if (this._renderTask === renderTask) this._renderTask = null;
    }
  }

  async ensureTextureFor(displayScale) {
    const needRerender = Math.abs(displayScale - this._lastTextureScale) > 0.35;
    if (needRerender) {
      const safeScale = clamp(displayScale, 0.5, 3.0);
      await this._renderTexture(safeScale);
    }
  }

  async render(ctx, canvas) {
    if (!this.page) return;
    const displayScale = this.scale * appState.currentZoom;
    this.ensureTextureFor(displayScale).catch((err) => {
      if (err && err.name === "RenderingCancelledException") return;
      console.error("Error updating PDF texture:", err);
    });

    const drawW = this.basePx.width * displayScale;
    const drawH = this.basePx.height * displayScale;

    const cpx = normToPx(this.center.x, this.center.y, canvas);
    const drawX = cpx.x - drawW / 2;
    const drawY = cpx.y - drawH / 2;

    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);
  }

  isPointOnPdf(px, py, canvas) {
    if (!this.page) return false;
    const displayScale = this.scale * appState.currentZoom;
    const drawW = this.basePx.width * displayScale;
    const drawH = this.basePx.height * displayScale;

    const cpx = normToPx(this.center.x, this.center.y, canvas);
    const left = cpx.x - drawW / 2;
    const right = cpx.x + drawW / 2;
    const top = cpx.y - drawH / 2;
    const bottom = cpx.y + drawH / 2;

    return px >= left && px <= right && py >= top && py <= bottom;
  }

  /**
   * Hit-test con margen negativo (más estricto).
   * El punto debe estar dentro del PDF con un margen de seguridad.
   */
  isPointOnPdfWithMargin(px, py, canvas, margin = 0) {
    if (!this.page) return false;
    const displayScale = this.scale * appState.currentZoom;
    const drawW = this.basePx.width * displayScale;
    const drawH = this.basePx.height * displayScale;

    const cpx = normToPx(this.center.x, this.center.y, canvas);
    const left = cpx.x - drawW / 2 + margin;
    const right = cpx.x + drawW / 2 - margin;
    const top = cpx.y - drawH / 2 + margin;
    const bottom = cpx.y + drawH / 2 - margin;

    if (left >= right || top >= bottom) return false;

    return px >= left && px <= right && py >= top && py <= bottom;
  }

  clampCenter(posNorm, canvas) {
    const displayScale = this.scale * appState.currentZoom;
    const halfW = (this.basePx.width * displayScale) / (2 * canvas.width);
    const halfH = (this.basePx.height * displayScale) / (2 * canvas.height);
    return {
      x: clamp(posNorm.x, halfW, 1 - halfW),
      y: clamp(posNorm.y, halfH, 1 - halfH),
    };
  }

  async goToPage(n) {
    if (!this.pdfDoc) return;
    const page = clamp(n, 1, this.pdfDoc.numPages);
    if (page === this.pageNum) return;
    this.pageNum = page;
    this.page = await this.pdfDoc.getPage(this.pageNum);
    await this._renderTexture(this._lastTextureScale || 1);
  }
  async nextPage() {
    await this.goToPage(this.pageNum + 1);
  }
  async prevPage() {
    await this.goToPage(this.pageNum - 1);
  }

  /**
   * Cierra el documento PDF actual y limpia el estado
   */
  close() {
    // Cancelar render en progreso
    if (this._renderTask && typeof this._renderTask.cancel === "function") {
      try {
        this._renderTask.cancel();
      } catch (err) {
        console.error("Error canceling render:", err);
      }
      this._renderTask = null;
    }

    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    this.page = null;
    this.pageNum = 1;
    this.basePx = { width: 0, height: 0 };
    this.center = { x: 0.5, y: 0.5 };
    this.scale = 1;
    this._lastTextureScale = 0;

    this.offctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    this.offscreen.width = 1;
    this.offscreen.height = 1;

    console.log("📄 Documento cerrado");
  }

  get isLoaded() {
    return this.pdfDoc !== null && this.page !== null;
  }
}

export const pdfManager = new PdfManager();
export { PdfManager };
