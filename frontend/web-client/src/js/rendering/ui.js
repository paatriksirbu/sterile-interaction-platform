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
 * Actualiza los badges de estado de gestos
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
