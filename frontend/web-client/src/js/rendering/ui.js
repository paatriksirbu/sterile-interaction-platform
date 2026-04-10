import { CONFIG } from "../config.js";

/**
 * Genera el texto del panel de información de landmarks
 * @param {Array} multiHandLandmarks - Landmarks de todas las manos
 * @param {Array} multiHandedness - Información de lateralidad
 * @returns {string} Texto formateado para el panel
 */
export function generateLandmarksPanel(multiHandLandmarks, multiHandedness) {
  if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
    return "Esperando manos…";
  }

  let text = "";

  multiHandLandmarks.forEach((landmarks, handIndex) => {
    const handType = multiHandedness?.[handIndex]?.label || "Unknown";
    const score = multiHandedness?.[handIndex]?.score || 0;

    text += `\n═══════════════════════════════\n`;
    text += `MANO ${handIndex + 1}: ${handType} (${(score * 100).toFixed(1)}%)\n`;
    text += `═══════════════════════════════\n\n`;

    // landmarks.forEach((lm, lmIndex) => {
    //   const landmarkName = getLandmarkName(lmIndex);
    //   text += `[${lmIndex.toString().padStart(2, '0')}] ${landmarkName.padEnd(15)}: `;
    //   text += `x=${lm.x.toFixed(4)} y=${lm.y.toFixed(4)} z=${lm.z.toFixed(4)}\n`;
    // });
  });

  return text;
}

/**
 * Obtiene el nombre descriptivo de un landmark por su índice
 * @param {number} index - Índice del landmark (0-20)
 * @returns {string} Nombre del landmark
 */
function getLandmarkName(index) {
  const names = [
    "WRIST", // 0
    "THUMB_CMC", // 1
    "THUMB_MCP", // 2
    "THUMB_IP", // 3
    "THUMB_TIP", // 4
    "INDEX_MCP", // 5
    "INDEX_PIP", // 6
    "INDEX_DIP", // 7
    "INDEX_TIP", // 8
    "MIDDLE_MCP", // 9
    "MIDDLE_PIP", // 10
    "MIDDLE_DIP", // 11
    "MIDDLE_TIP", // 12
    "RING_MCP", // 13
    "RING_PIP", // 14
    "RING_DIP", // 15
    "RING_TIP", // 16
    "PINKY_MCP", // 17
    "PINKY_PIP", // 18
    "PINKY_DIP", // 19
    "PINKY_TIP", // 20
  ];
  return names[index] || "UNKNOWN";
}

/**
 * Genera el texto del panel de estado de gestos
 * @param {Object} gestureState - Estado de los gestos del detector
 * @param {number} zoom - Zoom actual
 * @param {Object} squareInfo - Información de los cuadrados
 * @returns {string} Texto formateado
 
export function generateGestureStatusPanel(gestureState, zoom, squareInfo = null) {
  let text = '\n═══ ESTADO DE GESTOS ═══\n\n';


  // Pinch
  const pinchStatus = gestureState.pinch.confirmed ? '✅ CONFIRMADO' :
                      gestureState.pinch.detected ? `⏳ ${gestureState.pinch.frameCount}/${CONFIG.FRAMES.PINCH}` :
                      '❌';
  text += `🤏 Pinch: ${pinchStatus}\n`;
  if (gestureState.pinch.distance) {
    text += `   Distancia: ${gestureState.pinch.distance.toFixed(3)}\n`;
  }


  // Pointing
  const pointingStatus = gestureState.pointing.confirmed ? '✅ CONFIRMADO' :
                         gestureState.pointing.detected ? `⏳ ${gestureState.pointing.frameCount}/${CONFIG.FRAMES.POINTING}` :
                         '❌';
  text += `👉 Pointing: ${pointingStatus}\n`;


  // Spherical
  const sphericalStatus = gestureState.spherical.confirmed ? '✅ CONFIRMADO' :
                          gestureState.spherical.detected ? `⏳ ${gestureState.spherical.frameCount}/${CONFIG.FRAMES.SPHERICAL}` :
                          '❌';
  text += `🌐 Esférico: ${sphericalStatus}\n`;


  // Closed Fist
  const fistStatus = gestureState.closedFist.confirmed ? '✅ CONFIRMADO' :
                     gestureState.closedFist.detected ? `⏳ ${gestureState.closedFist.frameCount}/${CONFIG.FRAMES.CLOSED_FIST}` :
                     '❌';
  text += `✊ Puño: ${fistStatus}\n`;


  // Open Hand
  const openHandStatus = gestureState.openHand?.confirmed ? '✅ CONFIRMADO' :
                         gestureState.openHand?.detected ? `⏳ ${gestureState.openHand.frameCount}/${CONFIG.FRAMES.OPEN_HAND}` :
                         '❌';
  text += `🖐️ Mano Abierta: ${openHandStatus}\n`;


  text += `\n═══ SISTEMA ═══\n\n`;
  text += `🔍 Zoom: ${zoom.toFixed(2)}x\n`;


  if (squareInfo) {
    text += `\n═══ CUADRADOS ═══\n\n`;
    text += `📦 Total: ${squareInfo.count}\n`;
    if (squareInfo.activeId !== null) {
      text += `🎯 Activo: #${squareInfo.activeId}\n`;
      text += `📍 Centro: (${squareInfo.center?.x.toFixed(3)}, ${squareInfo.center?.y.toFixed(3)})\n`;
    }
    if (squareInfo.movingWith) {
      text += `✋ Moviendo con: ${squareInfo.movingWith}\n`;
    }
  }


  return text;
}
*/
// export function generateGestureStatusPanel(gestureState, zoom, squareInfo = null) {
//   let text = "\n═══ ESTADO DE GESTOS ═══\n\n";

//   // === SOLO PINCH ===
//   const pinchStatus = gestureState.pinch.confirmed
//     ? "✅ CONFIRMADO"
//     : gestureState.pinch.detected
//       ? `⏳ ${gestureState.pinch.frameCount}/${CONFIG.FRAMES.PINCH}`
//       : "❌";

//   text += `🤏 Pinch: ${pinchStatus}\n`;

//   if (gestureState.pinch.distance) {
//     text += `   Distancia: ${gestureState.pinch.distance.toFixed(3)}\n`;
//   }

//   text += `\n═══ SISTEMA ═══\n\n`;
//   text += `🔍 Zoom: ${zoom.toFixed(2)}x\n`;

//   if (squareInfo) {
//     text += `\n═══ CUADRADOS ═══\n\n`;
//     text += `📦 Total: ${squareInfo.count}\n`;

//     if (squareInfo.activeId !== null) {
//       text += `🎯 Activo: #${squareInfo.activeId}\n`;
//       text += `📍 Centro: (${squareInfo.center?.x.toFixed(3)}, ${squareInfo.center?.y.toFixed(3)})\n`;
//     }

//     if (squareInfo.movingWith) {
//       text += `✋ Moviendo con: ${squareInfo.movingWith}\n`;
//     }
//   }

//   return text;
// }

/**
 * Actualiza el contenido del elemento HTML de información
 * @param {HTMLElement} element - Elemento DOM a actualizar
 * @param {string} text - Texto a mostrar
 */
export function updateInfoElement(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/**
 * Genera el HTML de la leyenda de colores
 * @returns {string} HTML de la leyenda
 */
export function generateColorLegend() {
  return `
    <span style="color: ${CONFIG.COLORS.Left};">● Left</span> |
    <span style="color: ${CONFIG.COLORS.Right};">● Right</span> |
    <span style="color: ${CONFIG.COLORS.Unknown};">● Unknown</span>
  `;
}

/**
 * Genera el HTML del panel de información principal
 * @returns {string} HTML del panel
 */
// export function generateInfoPanelHTML() {
//   return `
//     👋 Esqueleto de manos + cuadrado interactivo.<br />
//     📌 Panel a la derecha: 21 landmarks (x, y, z) por mano.<br />
//     🪞 Modo espejo activado.<br />
//     <br />
//     <b>Gestos activos:</b><br />
//     🤏 <b>Pinch</b>: Zoom global (pulgar-índice)<br />
//     <!--     👉 <b>Pointing</b>: Detección de dedo apuntando<br />
//     🌐 <b>Esférico</b>: Agarre esférico<br />
//     ✊ <b>Puño cerrado</b>: Detecta puño completamente cerrado<br />
//     🖐️ <b>Mano abierta</b>: Navegacion/Scroll<br />
//     <br />
//     <b>Cuadrado interactivo:</b><br />
//     ✋ <b>Mover</b>: Pinch pulgar-índice O agarre esférico sobre cuadrado<br />
//     ➕ <b>Duplicar</b>: Tocar pulgar-anular (máx ${CONFIG.SQUARES.MAX_COUNT}) -->
//   `;
// }

/**
 * Actualiza los badges de estado de gestos


export function updateGestureBadges(gestureState) {
  const badges = {
    'dot-pinch': gestureState.pinch,
    'dot-pointing': gestureState.pointing,
    'dot-spherical': gestureState.spherical,
    'dot-fist': gestureState.closedFist,
    'dot-openhand': gestureState.openHand
  };


  for (const [id, state] of Object.entries(badges)) {
    const dot = document.getElementById(id);
    if (!dot) continue;


    dot.classList.remove('off', 'detecting', 'confirmed');
    if (state?.confirmed) {
      dot.classList.add('confirmed');
    } else if (state?.detected) {
      dot.classList.add('detecting');
    } else {
      dot.classList.add('off');
    }
  }
}
  */

export function updateGestureBadges(gestureState) {
  // SOLO PINCH Y OPEN HAND, LOS DEMÁS SE MUESTRAN COMO "OFF" SI EXISTEN
  const pinchDot = document.getElementById("dot-pinch");
  if (pinchDot) {
    pinchDot.classList.remove("off", "detecting", "confirmed");

    if (gestureState.pinch.confirmed) {
      pinchDot.classList.add("confirmed");
    } else if (gestureState.pinch.detected) {
      pinchDot.classList.add("detecting");
    } else {
      pinchDot.classList.add("off");
    }
  }

  const openHandDot = document.getElementById("dot-openhand");
  if (openHandDot) {
    openHandDot.classList.remove("off", "detecting", "confirmed");
    if (gestureState.openHand?.confirmed) {
      openHandDot.classList.add("confirmed");
    } else if (gestureState.openHand?.detected) {
      openHandDot.classList.add("detecting");
    } else {
      openHandDot.classList.add("off");
    }
  }

  // === GESTOS DESACTIVADOS (se fuerzan a "off") ===
  const disabled = [
    "dot-pointing",
    "dot-spherical",
    "dot-fist",
    // 'dot-openhand'
  ];

  for (const id of disabled) {
    const dot = document.getElementById(id);
    if (dot) {
      dot.classList.remove("detecting", "confirmed");
      dot.classList.add("off"); // se muestra apagado SI existe
      dot.style.opacity = "0.25"; // aún más tenue (opcional)
    }
  }
}
