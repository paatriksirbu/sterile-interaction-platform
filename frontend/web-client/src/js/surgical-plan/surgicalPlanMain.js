import { initMediaPipe } from "../utils/mediapipeSetup.js";
import { gestureDetector } from "../gestures/detector.js";
import { applyMirror } from "../utils/canvas.js";
import { drawAllHands } from "../rendering/hands.js";
import {
  updateHandTrackingHUD,
  initHandTrackingHUD,
  showGestureFeedback,
} from "../rendering/handTrackingHUD.js";

import {
  SURGICAL_STEPS,
  PREOP_CHECKLIST,
  MODEL_VIEWS,
  getCountdown,
} from "./surgicalPlanData.js";

import {
  processSurgicalPlanGestures,
  processSwipeGesture,
  setActionCallbacks,
} from "./surgicalPlanGestures.js";

import { speechService } from "../services/speechService.js";
import { sendGestureIfConfirmed } from "../services/gestureApiService.js";
import { CONFIG } from "../config.js";

const state = {
  currentStepIndex: 0,
  steps: JSON.parse(JSON.stringify(SURGICAL_STEPS)),
  checklist: JSON.parse(JSON.stringify(PREOP_CHECKLIST)),
  notes: [],
  currentView: "front",
  zoom: 1,
  isRecording: false,
  handsDetected: false,
};

const videoElement = document.querySelector(".input_video");
const overlay = document.getElementById("overlay");
const ctx = overlay?.getContext("2d");
const gestureCanvas = document.getElementById("gesture-canvas");
const gestureCtx = gestureCanvas?.getContext("2d");
const threeCanvas = document.getElementById("three-canvas");

let scene, camera, renderer, model;

async function initThreeJS() {
  const THREE = await import("three");
  const { OrbitControls } =
    await import("three/addons/controls/OrbitControls.js");
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");

  const container = document.querySelector(".model-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050810);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  // Posicion inicial
  camera.position.set(0, 0, 6);
  camera.up.set(0, 1, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0x88bbff, 0.6);
  directionalLight2.position.set(-5, -5, -5);
  scene.add(directionalLight2);

  const rimLight = new THREE.DirectionalLight(0x18b6ff, 0.4);
  rimLight.position.set(0, 0, -5);
  scene.add(rimLight);

  // Cargar texturas para el modelo de la rodilla
  const textureLoader = new THREE.TextureLoader();
  const diffuseTexture = textureLoader.load(
    "../assets/knee/tex_u1_v1_diffuse.jpg",
  );
  const normalTexture = textureLoader.load(
    "../assets/knee/tex_u1_v1_normal.jpg",
  );

  // Configurar texturas
  diffuseTexture.colorSpace = THREE.SRGBColorSpace;

  // Cargar modelo de la rodilla
  const fbxLoader = new FBXLoader();

  try {
    const fbxModel = await new Promise((resolve, reject) => {
      fbxLoader.load(
        "../assets/knee/model.fbx",
        (object) => resolve(object),
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`[SurgicalPlan] Loading model: ${percent.toFixed(1)}%`);
        },
        (error) => reject(error),
      );
    });

    // Aplicar texturas a las mallas del modelo
    fbxModel.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: diffuseTexture,
          normalMap: normalTexture,
          roughness: 0.6,
          metalness: 0.1,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(fbxModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Centrar el modelo
    fbxModel.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    fbxModel.scale.setScalar(scale);

    // Bajar el modelo en el eje Y
    fbxModel.position.y -= 1.5;

    model = fbxModel;
    scene.add(model);

    console.log("[SurgicalPlan] Knee model loaded successfully");
  } catch (error) {
    console.error("[SurgicalPlan] Error loading knee model:", error);

    const placeholderGeom = new THREE.SphereGeometry(1, 32, 32);
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0xe8dcc8,
      roughness: 0.5,
    });
    model = new THREE.Mesh(placeholderGeom, placeholderMat);
    scene.add(model);
  }

  const gridHelper = new THREE.GridHelper(10, 20, 0x18b6ff, 0x0a1520);
  gridHelper.position.y = -2;
  scene.add(gridHelper);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 12;
  controls.target.set(0, 0, 0);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  console.log("[SurgicalPlan] Three.js initialized");
}

function renderSteps() {
  const container = document.getElementById("steps-list");
  if (!container) return;

  container.innerHTML = state.steps
    .map(
      (step, index) => `
    <div class="step-item ${index === state.currentStepIndex ? "active" : ""} ${step.completed ? "completed" : ""}"
         data-step-id="${step.id}">
      <div class="step-number">${step.completed ? '<i class="fa-solid fa-check"></i>' : step.id}</div>
      <div class="step-content">
        <div class="step-title">${step.title}</div>
        <div class="step-detail">${step.detail}</div>
        <div class="step-duration"><i class="fa-regular fa-clock"></i> ${step.duration}</div>
      </div>
      <div class="step-status">
        ${step.completed ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-regular fa-circle"></i>'}
      </div>
    </div>
  `,
    )
    .join("");

  updateProgress();
}

function renderChecklist() {
  const container = document.getElementById("preop-checklist");
  if (!container) return;

  container.innerHTML = state.checklist
    .map(
      (item) => `
    <div class="checklist-item ${item.checked ? "checked" : ""}" data-check-id="${item.id}">
      <div class="check-box">
        ${item.checked ? '<i class="fa-solid fa-check"></i>' : ""}
      </div>
      <span class="check-label">${item.label}</span>
    </div>
  `,
    )
    .join("");

  updateChecklistCount();
}

function updateProgress() {
  const completed = state.steps.filter((s) => s.completed).length;
  const total = state.steps.length;

  const progressEl = document.getElementById("steps-progress");
  const fillEl = document.getElementById("progress-fill");

  if (progressEl) progressEl.textContent = `${completed}/${total}`;
  if (fillEl) fillEl.style.width = `${(completed / total) * 100}%`;
}

function updateChecklistCount() {
  const completed = state.checklist.filter((c) => c.checked).length;
  const total = state.checklist.length;

  const countEl = document.getElementById("checklist-count");
  if (countEl) countEl.textContent = `${completed}/${total}`;
}

function updateZoomDisplay() {
  const zoomEl = document.getElementById("zoom-value");
  if (zoomEl) zoomEl.textContent = `${Math.round(state.zoom * 100)}%`;
}

function updateViewPresets(view) {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function updateCountdown() {
  const countdownEl = document.getElementById("countdown");
  if (countdownEl) {
    countdownEl.textContent = getCountdown("09:30");
  }
}

function addNote(text) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  state.notes.push({ id: Date.now(), time, text });

  renderNotesList();
  renderModalNotes();
}

function renderNotesList() {
  const container = document.getElementById("notes-list");
  if (!container) return;

  if (state.notes.length === 0) {
    container.innerHTML = `
      <div class="empty-notes">
        <i class="fa-solid fa-file-lines"></i>
        <span>Say "Add note" to record</span>
      </div>
    `;
    return;
  }

  container.innerHTML = state.notes
    .map(
      (note) => `
    <div class="note-item">
      <div class="note-time">${note.time}</div>
      <div class="note-text">${note.text}</div>
    </div>
  `,
    )
    .join("");
}

function renderModalNotes() {
  const container = document.getElementById("modal-notes-list");
  const countEl = document.getElementById("modal-notes-count");

  if (countEl) {
    countEl.textContent = `${state.notes.length} note${state.notes.length !== 1 ? "s" : ""}`;
  }

  if (!container) return;

  if (state.notes.length === 0) {
    container.innerHTML = `
      <div class="empty-notes-modal">
        <i class="fa-solid fa-file-audio"></i>
        <p>No voice notes recorded yet</p>
        <span>Use the microphone button or pinch gesture to record</span>
      </div>
    `;
    return;
  }

  container.innerHTML = state.notes
    .map(
      (note) => `
    <div class="modal-note-item" data-note-id="${note.id}">
      <div class="modal-note-header">
        <div class="modal-note-time">
          <i class="fa-regular fa-clock"></i>
          ${note.time}
        </div>
        <div class="modal-note-actions">
          <button class="copy" title="Copy to clipboard" data-action="copy">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button class="delete" title="Delete note" data-action="delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="modal-note-text">${note.text}</div>
    </div>
  `,
    )
    .join("");
}

function openNotesModal() {
  const modal = document.getElementById("notes-modal");
  if (modal) {
    renderModalNotes();
    modal.classList.add("show");
  }
}

function closeNotesModal() {
  const modal = document.getElementById("notes-modal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function deleteNote(noteId) {
  state.notes = state.notes.filter((n) => n.id !== noteId);
  renderNotesList();
  renderModalNotes();
}

function copyNoteToClipboard(noteId) {
  const note = state.notes.find((n) => n.id === noteId);
  if (note && navigator.clipboard) {
    navigator.clipboard.writeText(note.text).then(() => {
      console.log("Note copied to clipboard");
    });
  }
}

function selectStep(stepId) {
  const index = state.steps.findIndex((s) => s.id === stepId);
  if (index !== -1) {
    state.currentStepIndex = index;
    renderSteps();

    const stepEl = document.querySelector(`[data-step-id="${stepId}"]`);
    stepEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function completeCurrentStep() {
  const step = state.steps[state.currentStepIndex];
  if (step) {
    step.completed = !step.completed;
    renderSteps();

    if (step.completed) {
      const nextIncomplete = state.steps.findIndex(
        (s, i) => i > state.currentStepIndex && !s.completed,
      );
      if (nextIncomplete !== -1) {
        state.currentStepIndex = nextIncomplete;
        renderSteps();
      }
    }
  }
}

function navigateSteps(direction) {
  if (direction === "prev" && state.currentStepIndex > 0) {
    state.currentStepIndex--;
  } else if (
    direction === "next" &&
    state.currentStepIndex < state.steps.length - 1
  ) {
    state.currentStepIndex++;
  }
  renderSteps();

  const stepEl = document.querySelector(
    `[data-step-id="${state.steps[state.currentStepIndex].id}"]`,
  );
  stepEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toggleChecklistItem(checkId) {
  const item = state.checklist.find((c) => c.id === checkId);
  if (item) {
    item.checked = !item.checked;
    renderChecklist();
  }
}

function setViewPreset(view) {
  state.currentView = view;
  updateViewPresets(view);

  if (camera && MODEL_VIEWS[view]) {
    const { position, target, up } = MODEL_VIEWS[view];

    // Calcular la posicion de la camara basada en la distancia original y el zoom actual
    const baseDistance = Math.sqrt(
      position[0] ** 2 + position[1] ** 2 + position[2] ** 2,
    );
    const zoomedDistance = baseDistance / state.zoom;

    // Obtener la direccion desde la posicion y escalar por la distancia con zoom
    const dirX = position[0] / baseDistance;
    const dirY = position[1] / baseDistance;
    const dirZ = position[2] / baseDistance;

    camera.position.set(
      dirX * zoomedDistance,
      dirY * zoomedDistance,
      dirZ * zoomedDistance,
    );

    if (up) {
      camera.up.set(...up);
    }
    camera.lookAt(...target);
  }
}

function adjustZoom(direction) {
  if (direction === "in") {
    state.zoom = Math.min(2, state.zoom + 0.1);
  } else {
    state.zoom = Math.max(0.5, state.zoom - 0.1);
  }
  updateZoomDisplay();

  if (camera) {
    const viewConfig = MODEL_VIEWS[state.currentView];
    const basePosition = viewConfig?.position || [0, 0, 6];
    const baseDistance = Math.sqrt(
      basePosition[0] ** 2 + basePosition[1] ** 2 + basePosition[2] ** 2,
    );

    // Aplicar zoom manteniendo la direccion de la camara
    const zoomedDistance = baseDistance / state.zoom;
    const dir = camera.position.clone().normalize();
    camera.position.copy(dir.multiplyScalar(zoomedDistance));
  }
}

function goBack() {
  window.location.href = "dashboard.html";
}

// ========== GRABACIÓN DE NOTAS DE VOZ ==========
let recordingTimeout = null;
const VOICE_NOTE_DURATION_MS = 10000; // 10 segundos de grabación máxima

async function toggleVoiceRecording(micButton) {
  const speechIndicator = document.getElementById("speech-indicator");

  // Si ya se está grabando, detener
  if (state.isRecording) {
    await stopVoiceRecording(micButton, speechIndicator);
    return;
  }

  state.isRecording = true;
  micButton?.classList.add("recording");
  speechIndicator?.classList.add("recording");

  const speechLabelEl = speechIndicator?.querySelector(".speech-label");
  if (speechLabelEl) speechLabelEl.textContent = "RECORDING...";

  if (!speechService.isConfigured) {
    const key = CONFIG.AZURE_SPEECH?.SUBSCRIPTION_KEY;
    const region = CONFIG.AZURE_SPEECH?.REGION;
    if (key && region) {
      speechService.configure(key, region);
    } else {
      console.warn("Azure Speech not configured, using simulation");
      simulateVoiceRecording(micButton, speechIndicator);
      return;
    }
  }

  try {
    speechService.onInterimResult((text) => {
      if (speechLabelEl)
        speechLabelEl.textContent = text
          ? `"${text.slice(0, 30)}..."`
          : "LISTENING...";
    });

    await speechService.startListening();
    console.log("🎤 Voice recording started");

    // Configurar timeout para detener la grabacion
    recordingTimeout = setTimeout(async () => {
      if (state.isRecording) {
        await stopVoiceRecording(micButton, speechIndicator);
      }
    }, VOICE_NOTE_DURATION_MS);
  } catch (error) {
    console.error("Failed to start voice recording:", error);
    simulateVoiceRecording(micButton, speechIndicator);
  }
}

async function stopVoiceRecording(micButton, speechIndicator) {
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }

  state.isRecording = false;
  micButton?.classList.remove("recording");
  speechIndicator?.classList.remove("recording");

  const speechLabelEl = speechIndicator?.querySelector(".speech-label");
  if (speechLabelEl) speechLabelEl.textContent = "PROCESSING...";

  try {
    const transcribedText = await speechService.stopListening();

    if (transcribedText && transcribedText.trim()) {
      addNote(transcribedText.trim());
      console.log("🎤 Voice note saved:", transcribedText);
    } else {
      console.log("🎤 No speech detected");
    }
  } catch (error) {
    console.error("Error stopping recording:", error);
  }

  if (speechLabelEl) speechLabelEl.textContent = "VOICE READY";
}

function simulateVoiceRecording(micButton, speechIndicator) {
  console.log("🎤 Using simulated voice recording");
  const speechLabelEl = speechIndicator?.querySelector(".speech-label");

  setTimeout(() => {
    state.isRecording = false;
    micButton?.classList.remove("recording");
    speechIndicator?.classList.remove("recording");

    // Agregar una nota de ejemplo
    const sampleNotes = [
      "Patient shows good range of motion in pre-op assessment.",
      "Verified implant size: 5mm tibial insert.",
      "Noted slight swelling, recommend ice post-op.",
      "Patient confirmed no allergies to latex.",
      "Surgical site marked and verified.",
    ];
    const randomNote =
      sampleNotes[Math.floor(Math.random() * sampleNotes.length)];
    addNote(randomNote);

    if (speechLabelEl) speechLabelEl.textContent = "VOICE READY";
  }, 3000);
}

function setupGestureCanvas() {
  if (!gestureCanvas || !gestureCtx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = 240;
  const cssH = 140;

  gestureCanvas.style.width = cssW + "px";
  gestureCanvas.style.height = cssH + "px";
  gestureCanvas.width = Math.round(cssW * dpr);
  gestureCanvas.height = Math.round(cssH * dpr);
  gestureCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  applyMirror(gestureCtx, gestureCanvas, true);
}

function onResults(results) {
  const hands = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];

  state.handsDetected = hands.length > 0;
  const statusEl = document.getElementById("hand-status");
  if (statusEl) {
    statusEl.classList.toggle("no-hand", !state.handsDetected);
  }

  // Pasar handedness para usar confianza en la priorización de manos
  const gestureState = gestureDetector.detectAll(hands, handedness);
  sendGestureIfConfirmed(gestureState, 'surgical_plan');

  // Update hand tracking HUD visualization
  updateHandTrackingHUD(hands, handedness, gestureState);

  const gestureStatusEl = document.getElementById("gesture-status");
  if (gestureStatusEl && gestureState?.hands?.length > 0) {
    const hand = gestureState.hands[0];
    const gestures = [];

    // Show gesture feedback badges
    if (hand?.pinch?.confirmed) {
      gestures.push("🤏 PINCH!");
      showGestureFeedback("pinch", true);
    } else if (hand?.pinch?.detected) {
      gestures.push("🤏 pinch...");
      showGestureFeedback("pinch", false);
    }

    if (hand?.openHand?.confirmed) {
      gestures.push("🖐️ OPEN");
      showGestureFeedback("openHand", true);
    } else if (hand?.openHand?.detected) {
      gestures.push("🖐️ open...");
    }

    if (hand?.closedFist?.confirmed) {
      gestures.push("✊ FIST");
      showGestureFeedback("closedFist", true);
    }

    if (hand?.pointing?.confirmed) {
      gestures.push("👆 POINT");
      showGestureFeedback("pointing", true);
    }

    gestureStatusEl.textContent =
      gestures.length > 0 ? gestures.join(" ") : "Tracking";
    gestureStatusEl.style.color = hand?.pinch?.confirmed ? "#00ff88" : "";
  } else if (gestureStatusEl) {
    gestureStatusEl.textContent = state.handsDetected ? "Tracking" : "No Hand";
    gestureStatusEl.style.color = "";
  }

  processSurgicalPlanGestures(hands, gestureState);

  const swipe = processSwipeGesture(hands, gestureState);
  if (swipe && model) {
    model.rotation.y += swipe.deltaX * 2;
    model.rotation.x += swipe.deltaY * 2;
  }

  if (gestureCanvas && gestureCtx) {
    gestureCtx.save();
    gestureCtx.setTransform(1, 0, 0, 1, 0, 0);
    gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
    gestureCtx.restore();

    if (hands.length > 0) {
      drawAllHands(gestureCtx, hands, handedness, {
        width: 240,
        height: 140,
        showMesh: true,
        dotSize: 3,
        lineWidth: 1.5,
      });
    }
  }

  if (overlay && ctx) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }
}

async function init() {
  console.log("[SurgicalPlan] Initializing...");

  setActionCallbacks({
    onStepSelect: selectStep,
    onStepComplete: completeCurrentStep,
    onChecklistToggle: toggleChecklistItem,
    onViewPresetSelect: setViewPreset,
    onZoom: adjustZoom,
    onNavigate: navigateSteps,
    onBack: goBack,
    onMicToggle: (element) => toggleVoiceRecording(element),
    onExpandNotes: openNotesModal,
    onCloseModal: closeNotesModal,
  });

  renderSteps();
  renderChecklist();
  updateZoomDisplay();
  updateCountdown();

  setInterval(updateCountdown, 1000);

  setupGestureCanvas();
  initHandTrackingHUD();

  if (overlay) {
    overlay.width = overlay.parentElement?.clientWidth || 800;
    overlay.height = overlay.parentElement?.clientHeight || 600;
  }

  try {
    await initThreeJS();
  } catch (e) {
    console.error("[SurgicalPlan] Three.js init failed:", e);
  }

  if (videoElement) {
    try {
      initMediaPipe(videoElement, onResults);
      console.log("[SurgicalPlan] MediaPipe initialized");
    } catch (e) {
      console.error("[SurgicalPlan] MediaPipe init failed:", e);
    }
  }

  setupClickHandlers();

  window.addEventListener("resize", () => {
    setupGestureCanvas();
    if (overlay) {
      overlay.width = overlay.parentElement?.clientWidth || 800;
      overlay.height = overlay.parentElement?.clientHeight || 600;
    }
  });

  console.log("[SurgicalPlan] Initialization complete");
}

function setupClickHandlers() {
  document.getElementById("btn-back")?.addEventListener("click", goBack);

  document.getElementById("steps-list")?.addEventListener("click", (e) => {
    const stepItem = e.target.closest(".step-item");
    if (stepItem) {
      const stepId = parseInt(stepItem.dataset.stepId, 10);
      selectStep(stepId);
    }
  });

  document
    .getElementById("btn-prev-step")
    ?.addEventListener("click", () => navigateSteps("prev"));
  document
    .getElementById("btn-next-step")
    ?.addEventListener("click", () => navigateSteps("next"));
  document
    .getElementById("btn-complete-step")
    ?.addEventListener("click", completeCurrentStep);

  document.getElementById("preop-checklist")?.addEventListener("click", (e) => {
    const checkItem = e.target.closest(".checklist-item");
    if (checkItem) {
      const checkId = parseInt(checkItem.dataset.checkId, 10);
      toggleChecklistItem(checkId);
    }
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => setViewPreset(btn.dataset.view));
  });

  document
    .getElementById("btn-zoom-in")
    ?.addEventListener("click", () => adjustZoom("in"));
  document
    .getElementById("btn-zoom-out")
    ?.addEventListener("click", () => adjustZoom("out"));

  document
    .getElementById("btn-reset-view")
    ?.addEventListener("click", () => setViewPreset("front"));

  document.getElementById("btn-record")?.addEventListener("click", (e) => {
    const micBtn = e.target.closest(".mic-btn");
    toggleVoiceRecording(micBtn);
  });

  document
    .getElementById("btn-expand-notes")
    ?.addEventListener("click", openNotesModal);
  document
    .getElementById("btn-close-modal")
    ?.addEventListener("click", closeNotesModal);

  document.getElementById("notes-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "notes-modal") {
      closeNotesModal();
    }
  });

  document
    .getElementById("btn-modal-record")
    ?.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-record-btn");
      toggleVoiceRecording(btn);
    });

  document
    .getElementById("modal-notes-list")
    ?.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("button[data-action]");
      if (!actionBtn) return;

      const noteItem = actionBtn.closest(".modal-note-item");
      const noteId = parseInt(noteItem?.dataset.noteId, 10);
      if (!noteId) return;

      const action = actionBtn.dataset.action;
      if (action === "delete") {
        deleteNote(noteId);
      } else if (action === "copy") {
        copyNoteToClipboard(noteId);
        actionBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
          actionBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 1000);
      }
    });

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeNotesModal();
    }
  });
}

init();
