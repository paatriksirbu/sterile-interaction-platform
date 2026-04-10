/**
 * Interacciones por zonas de la interfaz.
 *
 * SISTEMA DE COORDENADAS:
 * - Normalizadas (0..1): Coordenadas de MediaPipe, origen top-left
 * - Client (px): Coordenadas del viewport del navegador
 * - Canvas (px): Coordenadas internas del canvas
 *
 * ZONAS DE INTERACCIÓN:
 * - Pager (columna derecha): hover/click + scroll
 * - Open Hand scroll (sobre documento o rail)
 * - PDF (centro): arrastrar con pinch
 */
import { CONFIG } from "../config.js";
import { appState } from "../state/state.js";
import { pdfManager } from "../objects/pdfManager.js";
import { getFirstPinchPos, pinchToClientInContainer } from "./coordinates.js";
import {
  interactionState,
  OPENHAND_SCROLL_STEP_PX,
  OPENHAND_SCROLL_COOLDOWN_MS,
} from "./state.js";

/* ============================================================
    ZONA DERECHA (PAGER) — Hover/Click + Scroll por pinch
    ============================================================ */

/**
 * Procesa interacciones con el pager (botones prev/next y scroll).
 */
export function processPagerInteraction(hands) {
  const appEl = document.getElementById("app") || document.body;
  const pagerEl = document.getElementById("pager");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  if (!pagerEl || !btnPrev || !btnNext) return;

  const pinchPos = getFirstPinchPos(hands);
  const pinchActive = !!pinchPos;

  // Limpiar hover inicial
  btnPrev.classList.remove("hover");
  btnNext.classList.remove("hover");

  if (!pinchActive) {
    interactionState.prevPagerPinchActive = false;
    interactionState.lastPinchClientYPager = null;
    if (interactionState.activeDragContext === "pager")
      interactionState.activeDragContext = null;
    return;
  }

  // Coordenadas DOM del pinch respecto a #app
  const { clientX, clientY } = pinchToClientInContainer(
    pinchPos,
    appEl,
    CONFIG.MIRROR,
  );

  // Rects
  const rPrev = btnPrev.getBoundingClientRect();
  const rNext = btnNext.getBoundingClientRect();
  const rPager = pagerEl.getBoundingClientRect();

  const overPrev =
    clientX >= rPrev.left &&
    clientX <= rPrev.right &&
    clientY >= rPrev.top &&
    clientY <= rPrev.bottom;
  const overNext =
    clientX >= rNext.left &&
    clientX <= rNext.right &&
    clientY >= rNext.top &&
    clientY <= rNext.bottom;
  const overPager =
    clientX >= rPager.left &&
    clientX <= rPager.right &&
    clientY >= rPager.top &&
    clientY <= rPager.bottom;

  // Hover visual
  if (overPrev) btnPrev.classList.add("hover");
  if (overNext) btnNext.classList.add("hover");

  // Click por pinch al inicio
  const now = performance.now();
  const canClick =
    now - interactionState.lastPagerClickTs >
    CONFIG.INTERACTIONS.PAGER.CLICK_COOLDOWN_MS;
  if (pinchActive && !interactionState.prevPagerPinchActive && canClick) {
    if (overPrev) {
      btnPrev.click();
      interactionState.lastPagerClickTs = now;
      interactionState.activeDragContext = "pager";
      interactionState.blockPdfDragThisFrame = true;
    } else if (overNext) {
      btnNext.click();
      interactionState.lastPagerClickTs = now;
      interactionState.activeDragContext = "pager";
      interactionState.blockPdfDragThisFrame = true;
    } else if (overPager) {
      // Gesto comienza dentro del pager (lista) => habilitar scroll por pinch
      interactionState.activeDragContext = "pager";
      interactionState.blockPdfDragThisFrame = true;
      interactionState.pagerScrollAccumY = 0;
      interactionState.lastPinchClientYPager = clientY;
    }
  }

  // Scroll vertical con pinch dentro del pager => cambia página por umbral
  if (interactionState.activeDragContext === "pager" && overPager) {
    if (interactionState.lastPinchClientYPager == null)
      interactionState.lastPinchClientYPager = clientY;
    const dy = clientY - interactionState.lastPinchClientYPager;
    interactionState.lastPinchClientYPager = clientY;
    interactionState.pagerScrollAccumY += dy;
    const sinceLast = performance.now() - interactionState.lastPagerScrollTs;
    if (
      Math.abs(interactionState.pagerScrollAccumY) >=
        CONFIG.INTERACTIONS.PAGER.SCROLL_STEP_PX &&
      sinceLast >= CONFIG.INTERACTIONS.PAGER.SCROLL_COOLDOWN_MS
    ) {
      if (interactionState.pagerScrollAccumY > 0) {
        // Abajo => siguiente diapositiva
        btnNext.click();
      } else {
        // Arriba => anterior
        btnPrev.click();
      }
      interactionState.lastPagerScrollTs = performance.now();
      interactionState.pagerScrollAccumY = 0;
    }
  }

  interactionState.prevPagerPinchActive = pinchActive;
}

/* ============================================================
    OPEN HAND SCROLL (vertical sobre INFO o documento)
    ============================================================ */

/**
 * Procesa scroll con mano abierta sobre el documento o rail.
 */
export function processOpenHandScroll(hands, gestureState) {
  if (!gestureState) return;

  // Obtener canvas para mapear coordenadas correctamente
  const { canvas } = appState;
  if (!canvas) return;

  // Buscar primera mano con openHand detectado y palmCenter
  let palm = null;
  for (let i = 0; i < (hands?.length || 0); i++) {
    const hs = gestureState.hands[i];
    if (!hs) continue;
    if (hs.openHand?.detected && hs.openHand.palmCenter) {
      palm = hs.openHand.palmCenter;
      break;
    }
  }

  const openActive = !!palm;
  if (!openActive) {
    interactionState.prevOpenHandActive = false;
    interactionState.lastOpenHandClientY = null;
    if (interactionState.activeDragContext === "openhand")
      interactionState.activeDragContext = null;
    return;
  }

  // Mapear palmCenter (normalizado) a coordenadas client respecto al canvas
  const { clientX, clientY } = pinchToClientInContainer(
    palm,
    canvas,
    CONFIG.MIRROR,
  );
  const crect = canvas.getBoundingClientRect();

  // Scroll en el rail con la mano abierta
  const scrollRail = document.getElementById("scroll-rail");
  const trackEl = scrollRail?.querySelector(".track");
  const handleEl = scrollRail?.querySelector(".scroll-handle");
  const railPageEl = scrollRail?.querySelector(".page");
  const railOfEl = scrollRail?.querySelector(".of");

  if (scrollRail && trackEl && handleEl) {
    const railRect = scrollRail.getBoundingClientRect();
    const trackRect = trackEl.getBoundingClientRect();
    // Permite activar el rail aunque la mano no esté exactamente sobre él
    const activationLeft = Math.max(
      0,
      railRect.left - CONFIG.INTERACTIONS.RAIL.ACTIVATION_MARGIN_PX,
    );
    const overRail =
      clientX >= activationLeft &&
      clientX <= railRect.right &&
      clientY >= railRect.top &&
      clientY <= railRect.bottom;

    if (overRail && openActive && !interactionState.prevOpenHandActive) {
      // Gesto comienza dentro del rail
      interactionState.activeDragContext = "scroll-rail";
      interactionState.blockPdfDragThisFrame = true;
    }

    if (interactionState.activeDragContext === "scroll-rail" && overRail) {
      const relY = Math.min(
        Math.max(clientY - trackRect.top, 0),
        trackRect.height,
      );
      const targetPct = trackRect.height > 0 ? relY / trackRect.height : 0;

      if (typeof handleEl._currentPct === "undefined")
        handleEl._currentPct = targetPct;
      handleEl._currentPct +=
        (targetPct - handleEl._currentPct) *
        CONFIG.INTERACTIONS.RAIL.HANDLE_SMOOTHING;
      const pct = handleEl._currentPct;

      // Mover el control visual (centrado) - usar porcentaje como top
      handleEl.style.top = `${pct * 100}%`;

      // Mapear a índice de página (usar floor para control más estable/preciso)
      const total = pdfManager.pageCount || 1;
      const pageIndex = Math.floor(pct * (Math.max(total, 1) - 1)) + 1;

      // Cambiar página si el índice calculado es diferente al actual
      if (!handleEl._lastSetPageTs) handleEl._lastSetPageTs = 0;
      const now = performance.now();
      if (
        pageIndex !== pdfManager.pageNum &&
        now - handleEl._lastSetPageTs >
          CONFIG.INTERACTIONS.RAIL.PAGE_THROTTLE_MS
      ) {
        pdfManager.goToPage(pageIndex);
        interactionState.lastPageChangeTs = now; // Bloquear drag del PDF
        // Actualizar indicadores de página en el rail y central
        if (railPageEl) railPageEl.textContent = `PAGE ${pageIndex}`;
        if (railOfEl) railOfEl.textContent = `OF ${total}`;

        const pageIndicator = document.getElementById("page-indicator");
        if (pageIndicator)
          pageIndicator.textContent = `${pageIndex} / ${total}`;
        handleEl._lastSetPageTs = now;
      }

      // Mantener el contexto activo mientras se arrastra el rail
      interactionState.prevOpenHandActive = true;
      return; // Hemos manejado la interacción con el rail
    }
  }

  // Detectar si la mano está sobre el canvas (documento)
  const overCanvas =
    clientX >= crect.left &&
    clientX <= crect.right &&
    clientY >= crect.top &&
    clientY <= crect.bottom;

  // Convertir coordenadas client a coordenadas del canvas para hit-test del PDF
  let overPdf = false;
  if (overCanvas) {
    // Posición relativa al canvas en píxeles
    const palmPxX = clientX - crect.left;
    const palmPxY = clientY - crect.top;
    // Escalar a coordenadas internas del canvas
    const scaleX = canvas.width / crect.width;
    const scaleY = canvas.height / crect.height;
    const canvasPxX = palmPxX * scaleX;
    const canvasPxY = palmPxY * scaleY;
    // Aplicar espejo si está activado
    const visX = CONFIG.MIRROR ? canvas.width - canvasPxX : canvasPxX;
    const visY = canvasPxY;
    // Verificar si está sobre el PDF renderizado CON MARGEN ESTRICTO
    const margin = CONFIG.INTERACTIONS.OPENHAND.PDF_HIT_MARGIN_PX || 50;
    overPdf = pdfManager.isPointOnPdfWithMargin(visX, visY, canvas, margin);
  }

  // Inicio del gesto openHand solo si la mano esta sobre el PDF
  if (openActive && !interactionState.prevOpenHandActive && overPdf) {
    interactionState.activeDragContext = "openhand";
    interactionState.blockPdfDragThisFrame = true;
    interactionState.lastOpenHandClientY = clientY;
  }

  // Acumular movimiento vertical y cambiar de página - SOLO si la mano está sobre el PDF
  if (interactionState.activeDragContext === "openhand" && overPdf) {
    if (interactionState.lastOpenHandClientY == null)
      interactionState.lastOpenHandClientY = clientY;
    const dyPx = clientY - interactionState.lastOpenHandClientY;
    interactionState.lastOpenHandClientY = clientY;

    // Dirección del movimiento del frame actual
    const dir = Math.sign(dyPx) || 0;

    // Si la dirección cambió, reiniciamos la acumulación hacia la nueva dirección
    if (
      interactionState.openHandLastDir === 0 ||
      dir === interactionState.openHandLastDir
    ) {
      interactionState.openHandScrollAccumY += dyPx;
    } else {
      interactionState.openHandScrollAccumY = dyPx;
    }
    interactionState.openHandLastDir = dir || interactionState.openHandLastDir;

    const sinceLast = performance.now() - interactionState.lastOpenHandScrollTs;
    if (
      Math.abs(interactionState.openHandScrollAccumY) >=
        OPENHAND_SCROLL_STEP_PX &&
      sinceLast >= OPENHAND_SCROLL_COOLDOWN_MS
    ) {
      if (interactionState.openHandScrollAccumY > 0) {
        pdfManager.nextPage();
      } else {
        pdfManager.prevPage();
      }
      interactionState.lastOpenHandScrollTs = performance.now();
      interactionState.lastPageChangeTs = performance.now(); // Marcar cambio de página para bloquear drag
      // Reset acumulación
      interactionState.openHandScrollAccumY = 0;
      interactionState.openHandLastDir = 0;
    }
  } else if (interactionState.activeDragContext === "openhand" && !overPdf) {
    // Si la mano sale del PDF, resetear el contexto y la acumulación
    interactionState.activeDragContext = null;
    interactionState.openHandScrollAccumY = 0;
    interactionState.openHandLastDir = 0;
    interactionState.lastOpenHandClientY = null;
  }

  interactionState.prevOpenHandActive = openActive;
}
