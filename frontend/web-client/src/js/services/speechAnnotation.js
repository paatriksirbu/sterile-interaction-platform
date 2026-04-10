import { CONFIG } from "../config.js";
import { speechService, SpeechState } from "./speechService.js";
import { annotationManager } from "../objects/annotationManager.js";

/**
 * Clase que gestiona la integración speech-anotaciones
 */
class SpeechAnnotationService {
  constructor() {
    // Anotación actualmente en grabación
    this._currentAnnotationId = null;
    // Última anotación (para fallback si el resultado llega tarde)
    this._lastAnnotationId = null;

    // Estado
    this._isInitialized = false;

    // Timeout para auto-stop
    this._autoStopTimeout = null;

    // Bind de métodos
    this._onSpeechResult = this._onSpeechResult.bind(this);
    this._onSpeechStateChange = this._onSpeechStateChange.bind(this);
  }

  init() {
    if (this._isInitialized) return;

    const cfg = CONFIG.AZURE_SPEECH || {};

    // Configurar Azure Speech si hay credenciales
    if (cfg.SUBSCRIPTION_KEY && cfg.REGION) {
      speechService.configure(cfg.SUBSCRIPTION_KEY, cfg.REGION);
      console.log("🎤 Azure Speech configured");
    } else {
      console.warn(
        "🎤 Azure Speech credentials not found in CONFIG.AZURE_SPEECH",
      );
    }

    // Registrar listeners
    speechService.onStateChange(this._onSpeechStateChange);
    speechService.addListener((event, data) => {
      if (event === "result") {
        this._onSpeechResult(data.text);
      }
    });

    this._isInitialized = true;
    console.log("✅ Speech Annotation Service initialized");
  }

  /**
   * Verifica si el servicio está habilitado
   */
  get isEnabled() {
    return CONFIG.ANNOTATIONS?.SPEECH_ENABLED !== false;
  }

  /**
   * Verifica si está grabando
   */
  get isRecording() {
    return speechService.isListening;
  }

  /**
   * Inicia la grabación de voz para una anotación
   */
  async startRecordingForAnnotation(annotationId) {
    if (!this.isEnabled) {
      console.log("🎤 Speech annotations disabled");
      return false;
    }

    // Asegurar inicialización
    if (!this._isInitialized) {
      this.init();
    }

    // Cancelar grabación anterior si existe
    if (this._currentAnnotationId) {
      await this.stopRecording();
    }

    try {
      this._currentAnnotationId = annotationId;

      // Marcar anotación como "grabando"
      annotationManager.setRecordingState(annotationId, true);

      // Actualizar indicador de UI inmediatamente
      this._updateUIIndicator(true);

      // Iniciar reconocimiento de voz
      await speechService.startListening();

      // Auto-stop después del tiempo máximo
      const maxTime = CONFIG.AZURE_SPEECH?.MAX_RECORDING_MS || 10000;
      this._autoStopTimeout = setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, maxTime);

      console.log(`🎤 Started recording for annotation ${annotationId}`);
      return true;
    } catch (error) {
      console.error("🎤 Failed to start recording:", error);
      this._currentAnnotationId = null;
      annotationManager.setRecordingState(annotationId, false);
      this._updateUIIndicator(false);
      return false;
    }
  }

  /**
   * Detiene la grabación y guarda el texto
   * @returns {Promise<string>} El texto reconocido
   */
  async stopRecording() {
    if (!this._currentAnnotationId) {
      return "";
    }

    // Limpiar timeout
    if (this._autoStopTimeout) {
      clearTimeout(this._autoStopTimeout);
      this._autoStopTimeout = null;
    }

    const annotationId = this._currentAnnotationId;
    this._currentAnnotationId = null;

    try {
      const text = await speechService.stopListening();

      // Guardar texto en la anotación
      if (text) {
        annotationManager.updateSpeechText(annotationId, text);
      }

      // Quitar estado de grabación
      annotationManager.setRecordingState(annotationId, false);

      console.log(`🎤 Recording stopped. Text: "${text}"`);
      return text;
    } catch (error) {
      console.error("🎤 Error stopping recording:", error);
      annotationManager.setRecordingState(annotationId, false);
      return "";
    }
  }

  /**
   * Cancela la grabación actual
   */
  cancelRecording() {
    if (this._currentAnnotationId) {
      annotationManager.setRecordingState(this._currentAnnotationId, false);
      this._currentAnnotationId = null;
    }

    if (this._autoStopTimeout) {
      clearTimeout(this._autoStopTimeout);
      this._autoStopTimeout = null;
    }

    speechService.cancel();
    this._updateUIIndicator(false);
    console.log("🎤 Recording cancelled");
  }

  /**
   * Toggle de grabación para una anotación
   */
  async toggleRecording(annotationId) {
    if (this.isRecording && this._currentAnnotationId === annotationId) {
      return await this.stopRecording();
    } else {
      return await this.startRecordingForAnnotation(annotationId);
    }
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Callback cuando llega un resultado de speech
   */
  _onSpeechResult(text) {
    const annotationId = this._currentAnnotationId || this._lastAnnotationId;

    if (annotationId && text) {
      annotationManager.updateSpeechText(annotationId, text);
      console.log(`🎤 Speech result for annotation ${annotationId}: "${text}"`);
    }
  }

  /**
   * Callback para cambios de estado de speech
   */
  _onSpeechStateChange(newState, oldState) {
    console.log(`🎤 Speech state: ${oldState} -> ${newState}`);

    // Actualizar UI según estado
    if (newState === SpeechState.LISTENING) {
      this._updateUIIndicator(true);
    } else if (
      newState === SpeechState.IDLE ||
      newState === SpeechState.ERROR
    ) {
      this._updateUIIndicator(false);

      // Si terminó por error, limpiar estado
      if (newState === SpeechState.ERROR && this._currentAnnotationId) {
        annotationManager.setRecordingState(this._currentAnnotationId, false);
        this._currentAnnotationId = null;
      }
    }
  }

  /**
   * Actualiza el indicador visual de grabación en la UI
   */
  _updateUIIndicator(isRecording) {
    const indicator = document.getElementById("speech-indicator");
    if (indicator) {
      indicator.style.display = isRecording ? "flex" : "none";
    }
  }
}

// Singleton
export const speechAnnotation = new SpeechAnnotationService();

// Exportamos la clase
export { SpeechAnnotationService };
