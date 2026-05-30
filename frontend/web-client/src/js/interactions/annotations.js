import { CONFIG } from "../config.js";
import {
  annotationManager,
  ANNOTATION_TYPES,
} from "../objects/annotationManager.js";
import { recognizeAndPost } from "../services/annotationApiService.js";
import { getThumbIndexPinchPositions } from "../gestures/pinch.js";
import { normToPx } from "../utils/transforms.js";
import { interactionState, CANVAS_ANN_PANEL_COOLDOWN_MS } from "./state.js";
import { isIndexExtended, showGestureFeedback } from "./pdfZoom.js";

/* ============================================================
    CONFIGURACIÓN DEL PANEL
    ============================================================ */

const CANVAS_ANN_PANEL = {
  // x e y se calculan dinámicamente ahora
  btnWidth: 220,
  btnHeight: 60,
  gap: 12,
  hitMargin: 20,
  headerHeight: 48,
  bgColor: "rgba(30, 30, 40, 0.9)",
  borderColor: "rgba(255, 255, 255, 0.2)",
  hoverColor: "rgba(0, 255, 136, 0.3)",
  activeColor: "rgba(0, 255, 136, 0.15)",
  textColor: "#ffffff",
};

function getAnnotationPanelPosition(canvas) {
  const btnDashboard = document.getElementById("btn-dashboard");
  if (!btnDashboard || !canvas) {
    // Fallback si no existe el botón
    return { x: 20, y: 160 };
  }

  const btnRect = btnDashboard.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  // Calcular la posición del panel en coordenadas de cliente (pantalla)
  // Queremos que esté alineado con el botón dashboard (left) y debajo de él (top + height + margen)
  const clientX = btnRect.left;
  const clientY = btnRect.bottom + 120; // 120px de margen debajo del botón

  // Convertir coordenadas de cliente a coordenadas del canvas
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;

  const canvasX = (clientX - canvasRect.left) * scaleX;
  const canvasY = (clientY - canvasRect.top) * scaleY;

  return { x: Math.max(10, canvasX), y: Math.max(10, canvasY) };
}

/* ============================================================
    POINTING + DWELL PARA COLOCAR MARCAS
    ============================================================ */

function getPointingTip(hands, gestureState) {
  if (!gestureState || !hands) return null;

  for (let i = 0; i < (hands?.length || 0); i++) {
    const hs = gestureState.hands[i];
    if (!hs) continue;
    if (hs.pointing?.detected && hs.pointing.tip) {
      return { x: hs.pointing.tip.x, y: hs.pointing.tip.y };
    }
  }
  return null;
}

function showAnnotationFeedback(x, y, ctx, canvas) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(76, 175, 80, 0.5)";
  ctx.fill();
  ctx.restore();

  const gestureValue = document.getElementById("gesture-value");
  if (gestureValue) {
    const originalText = gestureValue.textContent;
    gestureValue.textContent = "✔ Marked!";
    gestureValue.style.color = "#4CAF50";
    setTimeout(() => {
      gestureValue.textContent = originalText;
      gestureValue.style.color = "";
    }, 800);
  }
}

export function processAnnotationPointing(hands, gestureState, ctx, canvas) {
  if (!gestureState || !canvas) return;

  // Resetear durante zoom (dos índices)
  if (
    hands &&
    hands.length >= 2 &&
    isIndexExtended(hands[0]) &&
    isIndexExtended(hands[1])
  ) {
    interactionState.annotationDwellPos = null;
    interactionState.annotationDwellStartTs = 0;
    interactionState.annotationDwellPdfCoords = null;
    interactionState.prevPointingActive = false;
    return;
  }

  const pointingTip = getPointingTip(hands, gestureState);
  const pointingActive = !!pointingTip;
  const cfg = CONFIG.ANNOTATIONS || {};
  const dwellMs = cfg.DWELL_MS || 600;

  if (!pointingActive) {
    interactionState.annotationDwellPos = null;
    interactionState.annotationDwellStartTs = 0;
    interactionState.annotationDwellPdfCoords = null;
    interactionState.prevPointingActive = false;
    return;
  }

  const tipPx = normToPx(pointingTip.x, pointingTip.y, canvas);
  const tipVisX = CONFIG.MIRROR ? canvas.width - tipPx.x : tipPx.x;
  const tipVisY = tipPx.y;

  const pdfCoords = annotationManager.canvasToPdfCoords(
    tipVisX,
    tipVisY,
    canvas,
  );

  if (!pdfCoords) {
    interactionState.annotationDwellPos = null;
    interactionState.annotationDwellStartTs = 0;
    interactionState.annotationDwellPdfCoords = null;
    interactionState.prevPointingActive = pointingActive;
    return;
  }

  const now = performance.now();
  const moveThreshold = 0.02;

  if (
    !interactionState.prevPointingActive ||
    !interactionState.annotationDwellPos
  ) {
    interactionState.annotationDwellPos = { x: tipPx.x, y: tipPx.y };
    interactionState.annotationDwellPdfCoords = pdfCoords;
    interactionState.annotationDwellStartTs = now;
  } else {
    const dx = tipPx.x - interactionState.annotationDwellPos.x;
    const dy = tipPx.y - interactionState.annotationDwellPos.y;
    const distNorm = Math.sqrt(dx * dx + dy * dy) / canvas.width;

    if (distNorm > moveThreshold) {
      interactionState.annotationDwellPos = { x: tipPx.x, y: tipPx.y };
      interactionState.annotationDwellPdfCoords = pdfCoords;
      interactionState.annotationDwellStartTs = now;
    }
  }

  const elapsed = now - interactionState.annotationDwellStartTs;
  const progress = Math.min(elapsed / dwellMs, 1.0);

  // Dibujar arco de progreso (usando coordenadas visuales/espejadas)
  ctx.save();
  const arcX = tipVisX; // Use mirrored coords to match where annotation will be placed
  const arcY = tipVisY;
  const arcRadius = 30;

  ctx.beginPath();
  ctx.arc(arcX, arcY, arcRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 4;
  ctx.stroke();

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + progress * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(arcX, arcY, arcRadius, startAngle, endAngle);
  ctx.strokeStyle = annotationManager.currentType.color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = annotationManager.currentType.color;
  ctx.fillText(annotationManager.currentType.icon, arcX, arcY);

  ctx.restore();

  if (progress >= 1.0 && interactionState.annotationDwellPdfCoords) {
    const currentCount = annotationManager.getCurrentPageAnnotations().length;
    const maxPerPage = cfg.MAX_PER_PAGE || 20;

    if (currentCount < maxPerPage) {
      const newAnnotation = annotationManager.addAnnotation(
        interactionState.annotationDwellPdfCoords.x,
        interactionState.annotationDwellPdfCoords.y,
      );
      showAnnotationFeedback(arcX, arcY, ctx, canvas);
      recognizeAndPost(newAnnotation.id);
    }

    interactionState.annotationDwellPos = null;
    interactionState.annotationDwellStartTs = 0;
    interactionState.annotationDwellPdfCoords = null;
  }

  interactionState.prevPointingActive = pointingActive;
}

/* ============================================================
    PANEL DE SELECCIÓN EN CANVAS
    ============================================================ */

export function processCanvasAnnotationPanel(hands, ctx, canvas) {
  const types = Object.values(ANNOTATION_TYPES);

  // Calcular posición dinámica del panel
  const panelPos = getAnnotationPanelPosition(canvas);
  const panelX = panelPos.x;
  const panelY = panelPos.y;

  const actionButtons = [
    {
      id: "clear-page",
      label: "Clear Page",
      icon: "🗑️",
      color: "#888",
      danger: false,
    },
    {
      id: "clear-all",
      label: "Clear All",
      icon: "⚠️",
      color: "#ef4444",
      danger: true,
    },
  ];

  const typesSectionHeight =
    types.length * (CANVAS_ANN_PANEL.btnHeight + CANVAS_ANN_PANEL.gap);
  const separatorHeight = 20;
  const actionBtnHeight = 60;
  const actionBtnGap = 10;
  const actionsSectionHeight =
    actionButtons.length * (actionBtnHeight + actionBtnGap);
  const panelHeight =
    typesSectionHeight +
    separatorHeight +
    actionsSectionHeight +
    CANVAS_ANN_PANEL.gap;

  // Obtener posición del pinch
  let pinchCanvasPx = null;
  let pinchActive = false;

  for (let i = 0; i < (hands?.length || 0); i++) {
    const pos = getThumbIndexPinchPositions(hands[i]);
    if (pos) {
      const px = normToPx(pos.x, pos.y, canvas);
      pinchCanvasPx = {
        x: CONFIG.MIRROR ? canvas.width - px.x : px.x,
        y: px.y,
      };
      pinchActive = true;
      break;
    }
  }

  // Detectar hover
  let hoveredType = null;
  let hoveredAction = null;
  const now = performance.now();

  types.forEach((type, i) => {
    const btnX = panelX;
    const btnY =
      panelY + i * (CANVAS_ANN_PANEL.btnHeight + CANVAS_ANN_PANEL.gap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = CANVAS_ANN_PANEL.btnHeight;

    if (pinchCanvasPx) {
      const margin = CANVAS_ANN_PANEL.hitMargin;
      if (
        pinchCanvasPx.x >= btnX - margin &&
        pinchCanvasPx.x <= btnX + btnW + margin &&
        pinchCanvasPx.y >= btnY - margin &&
        pinchCanvasPx.y <= btnY + btnH + margin
      ) {
        hoveredType = type.id;
      }
    }
  });

  const actionsStartY = panelY + typesSectionHeight + separatorHeight;
  actionButtons.forEach((action, i) => {
    const btnX = panelX;
    const btnY = actionsStartY + i * (actionBtnHeight + actionBtnGap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = actionBtnHeight;

    if (pinchCanvasPx) {
      const margin = CANVAS_ANN_PANEL.hitMargin;
      if (
        pinchCanvasPx.x >= btnX - margin &&
        pinchCanvasPx.x <= btnX + btnW + margin &&
        pinchCanvasPx.y >= btnY - margin &&
        pinchCanvasPx.y <= btnY + btnH + margin
      ) {
        hoveredAction = action.id;
      }
    }
  });

  // Detectar clicks
  if (
    pinchActive &&
    !interactionState.prevCanvasAnnPinchActive &&
    hoveredType
  ) {
    if (
      now - interactionState.canvasAnnPanelLastClick >
      CANVAS_ANN_PANEL_COOLDOWN_MS
    ) {
      annotationManager.setCurrentType(hoveredType);
      interactionState.canvasAnnPanelLastClick = now;
      const selectedType = types.find((t) => t.id === hoveredType);
      if (selectedType) {
        showGestureFeedback(selectedType.icon, selectedType.label);
      }
    }
  }

  if (
    pinchActive &&
    !interactionState.prevCanvasAnnPinchActive &&
    hoveredAction
  ) {
    if (
      now - interactionState.canvasAnnPanelLastClick >
      CANVAS_ANN_PANEL_COOLDOWN_MS
    ) {
      if (hoveredAction === "clear-page") {
        annotationManager.clearCurrentPage();
        showGestureFeedback("🗑️", "Page Cleared");
      } else if (hoveredAction === "clear-all") {
        annotationManager.clearAll();
        showGestureFeedback("⚠️", "All Cleared");
      }
      interactionState.canvasAnnPanelLastClick = now;
    }
  }

  interactionState.canvasAnnPanelHover = hoveredType || hoveredAction;

  // === RENDERIZAR EL PANEL ===
  ctx.save();

  const panelW = CANVAS_ANN_PANEL.btnWidth + CANVAS_ANN_PANEL.gap * 2;
  const totalPanelH =
    CANVAS_ANN_PANEL.headerHeight + panelHeight + CANVAS_ANN_PANEL.gap;
  const panelStartY =
    panelY - CANVAS_ANN_PANEL.headerHeight - CANVAS_ANN_PANEL.gap;

  // Fondo
  ctx.fillStyle = CANVAS_ANN_PANEL.bgColor;
  ctx.strokeStyle = CANVAS_ANN_PANEL.borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(
    panelX - CANVAS_ANN_PANEL.gap,
    panelStartY,
    panelW,
    totalPanelH,
    8,
  );
  ctx.fill();
  ctx.stroke();

  // Header
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.roundRect(
    panelX - CANVAS_ANN_PANEL.gap,
    panelStartY,
    panelW,
    CANVAS_ANN_PANEL.headerHeight,
    [8, 8, 0, 0],
  );
  ctx.fill();

  // Título
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "📍 MARKERS",
    panelX + panelW / 2 - CANVAS_ANN_PANEL.gap,
    panelStartY + CANVAS_ANN_PANEL.headerHeight / 2,
  );

  // Botones de tipo
  types.forEach((type, i) => {
    const btnX = panelX;
    const btnY =
      panelY + i * (CANVAS_ANN_PANEL.btnHeight + CANVAS_ANN_PANEL.gap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = CANVAS_ANN_PANEL.btnHeight;

    const isActive = annotationManager.currentType.id === type.id;
    const isHovered = hoveredType === type.id;

    if (isHovered) {
      ctx.fillStyle = CANVAS_ANN_PANEL.hoverColor;
    } else if (isActive) {
      ctx.fillStyle = CANVAS_ANN_PANEL.activeColor;
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    }

    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = isActive ? type.color : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(btnX + 30, btnY + btnH / 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = type.color;
    ctx.fill();

    ctx.fillStyle = isActive ? "#fff" : "rgba(255, 255, 255, 0.7)";
    ctx.font = "22px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(type.label, btnX + 56, btnY + btnH / 2);

    if (isActive) {
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(btnX + btnW - 20, btnY + btnH / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Separador
  const sepY = panelY + typesSectionHeight + separatorHeight / 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX, sepY);
  ctx.lineTo(panelX + CANVAS_ANN_PANEL.btnWidth, sepY);
  ctx.stroke();

  // Botones de acción
  actionButtons.forEach((action, i) => {
    const btnX = panelX;
    const btnY = actionsStartY + i * (actionBtnHeight + actionBtnGap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = actionBtnHeight;

    const isHovered = hoveredAction === action.id;

    if (isHovered) {
      ctx.fillStyle = action.danger
        ? "rgba(239, 68, 68, 0.3)"
        : CANVAS_ANN_PANEL.hoverColor;
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    }

    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 4);
    ctx.fill();

    ctx.strokeStyle =
      isHovered && action.danger
        ? "rgba(239, 68, 68, 0.5)"
        : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isHovered
      ? action.danger
        ? "#ef4444"
        : "#fff"
      : "rgba(255, 255, 255, 0.6)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${action.icon} ${action.label}`,
      btnX + btnW / 2,
      btnY + btnH / 2,
    );
  });

  // Contador
  const count = annotationManager.getTotalCount();
  const counterY = actionsStartY + actionsSectionHeight + 14;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `${count} marker${count !== 1 ? "s" : ""}`,
    panelX + CANVAS_ANN_PANEL.btnWidth / 2,
    counterY,
  );

  interactionState.prevCanvasAnnPinchActive = pinchActive;

  ctx.restore();
}

/**
 * Maneja el click del ratón sobre el panel de anotaciones en el canvas.
 */
function handleCanvasAnnotationClick(canvasX, canvasY, canvas) {
  const types = Object.values(ANNOTATION_TYPES);

  // Calcular posición dinámica del panel
  const panelPos = getAnnotationPanelPosition(canvas);
  const panelX = panelPos.x;
  const panelY = panelPos.y;

  const typesSectionHeight =
    types.length * (CANVAS_ANN_PANEL.btnHeight + CANVAS_ANN_PANEL.gap);
  const separatorHeight = 12;
  const actionBtnHeight = 32;
  const actionBtnGap = 6;
  const actionsStartY = panelY + typesSectionHeight + separatorHeight;

  const actionButtons = [
    { id: "clear-page", label: "Clear Page" },
    { id: "clear-all", label: "Clear All" },
  ];

  // Comprobar click en botones de tipo
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const btnX = panelX;
    const btnY =
      panelY + i * (CANVAS_ANN_PANEL.btnHeight + CANVAS_ANN_PANEL.gap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = CANVAS_ANN_PANEL.btnHeight;

    if (
      canvasX >= btnX &&
      canvasX <= btnX + btnW &&
      canvasY >= btnY &&
      canvasY <= btnY + btnH
    ) {
      annotationManager.setCurrentType(type.id);
      showGestureFeedback(type.icon, type.label);
      return true;
    }
  }

  // Comprobar click en botones de acción
  for (let i = 0; i < actionButtons.length; i++) {
    const action = actionButtons[i];
    const btnX = panelX;
    const btnY = actionsStartY + i * (actionBtnHeight + actionBtnGap);
    const btnW = CANVAS_ANN_PANEL.btnWidth;
    const btnH = actionBtnHeight;

    if (
      canvasX >= btnX &&
      canvasX <= btnX + btnW &&
      canvasY >= btnY &&
      canvasY <= btnY + btnH
    ) {
      if (action.id === "clear-page") {
        annotationManager.clearCurrentPage();
        showGestureFeedback("🗑️", "Page Cleared");
      } else if (action.id === "clear-all") {
        annotationManager.clearAll();
        showGestureFeedback("⚠️", "All Cleared");
      }
      return true;
    }
  }

  return false;
}

export function initCanvasClickListeners(canvas) {
  if (!canvas) return;

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    handleCanvasAnnotationClick(canvasX, canvasY, canvas);
  });

  console.log("✅ Canvas click listeners initialized");
}
