import { CONFIG } from "../config.js";

/**
 * Estados del servicio de voz
 */
export const SpeechState = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  ERROR: "error",
};

/**
 * Clase para gestionar el reconocimiento de voz con Azure Speech SDK
 */
class SpeechService {
  constructor() {
    // Configuración de Azure
    this._subscriptionKey = null;
    this._region = null;
    this._language = "es-ES";

    // Estado actual
    this._state = SpeechState.IDLE;

    // Azure Speech SDK objects
    this._speechConfig = null;
    this._audioConfig = null;
    this._recognizer = null;

    // Resultado acumulado
    this._lastResult = "";

    // Callbacks
    this._onStateChange = null;
    this._onInterim = null;

    // Timeout para grabación
    this._recordingTimeout = null;
    this._maxRecordingMs = 10000; // 10 segundos máximo

    // Listeners
    this._listeners = [];
  }

  /**
   * Configura las credenciales de Azure Speech Service
   */
  configure(subscriptionKey, region) {
    this._subscriptionKey = subscriptionKey;
    this._region = region;
    this._language = CONFIG.AZURE_SPEECH?.LANGUAGE || "es-ES";
    console.log(
      `🎤 Speech Service configured for region: ${region}, language: ${this._language}`,
    );
  }

  /**
   * Verifica si el servicio está configurado
   */
  get isConfigured() {
    return !!(this._subscriptionKey && this._region);
  }

  /**
   * Obtiene el estado actual
   */
  get state() {
    return this._state;
  }

  /**
   * Verifica si está escuchando
   */
  get isListening() {
    return this._state === SpeechState.LISTENING;
  }

  /**
   * Inicia el reconocimiento de voz con Azure Speech SDK
   * @returns {Promise<void>}
   */
  async startListening() {
    if (this._state === SpeechState.LISTENING) {
      console.warn("🎤 Already listening");
      return;
    }

    if (typeof SpeechSDK === "undefined") {
      console.error(
        "🎤 Azure Speech SDK not loaded. Make sure to include the SDK script.",
      );
      this._setState(SpeechState.ERROR);
      throw new Error("Azure Speech SDK not loaded");
    }

    if (!this.isConfigured) {
      console.error(
        "🎤 Azure Speech Service not configured. Call configure() first.",
      );
      this._setState(SpeechState.ERROR);
      throw new Error("Azure Speech Service not configured");
    }

    this._setState(SpeechState.LISTENING);
    this._lastResult = "";

    try {
      await this._startAzureSpeechSDK();
    } catch (error) {
      console.error("🎤 Error starting Azure Speech recognition:", error);
      this._cleanup();
      this._setState(SpeechState.ERROR);
      throw error;
    }
  }

  /**
   * Detiene el reconocimiento de voz
   */
  async stopListening() {
    if (this._state !== SpeechState.LISTENING) {
      return this._lastResult || "";
    }

    this._setState(SpeechState.PROCESSING);

    if (this._recordingTimeout) {
      clearTimeout(this._recordingTimeout);
      this._recordingTimeout = null;
    }

    return new Promise((resolve) => {
      if (this._recognizer) {
        this._recognizer.stopContinuousRecognitionAsync(
          () => {
            console.log("🎤 Azure recognition stopped");
            const result = this._lastResult || "";
            this._cleanup();
            this._setState(SpeechState.IDLE);
            resolve(result);
          },
          (error) => {
            console.error("🎤 Error stopping Azure recognition:", error);
            this._cleanup();
            this._setState(SpeechState.ERROR);
            resolve(this._lastResult || "");
          },
        );
      } else {
        this._setState(SpeechState.IDLE);
        resolve(this._lastResult || "");
      }
    });
  }

  /**
   * Cancela el reconocimiento actual sin procesar
   */
  cancel() {
    if (this._recordingTimeout) {
      clearTimeout(this._recordingTimeout);
      this._recordingTimeout = null;
    }

    if (this._recognizer) {
      this._recognizer.stopContinuousRecognitionAsync(
        () => {
          this._cleanup();
        },
        () => {
          this._cleanup();
        },
      );
    }

    this._lastResult = "";
    this._setState(SpeechState.IDLE);
  }

  /**
   * Registra un callback para cambios de estado
   */
  onStateChange(callback) {
    this._onStateChange = callback;
  }

  /**
   * Registra un callback para resultados intermedios
   */
  onInterimResult(callback) {
    this._onInterim = callback;
  }

  /**
   * Registra un listener general
   */
  addListener(callback) {
    this._listeners.push(callback);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  _setState(newState) {
    const oldState = this._state;
    this._state = newState;

    if (this._onStateChange) {
      this._onStateChange(newState, oldState);
    }

    this._notifyListeners("stateChange", { newState, oldState });
  }

  _notifyListeners(event, data) {
    for (const listener of this._listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error("Speech listener error:", e);
      }
    }
  }

  /**
   * Inicia el reconocimiento usando Azure Speech SDK
   */
  async _startAzureSpeechSDK() {
    // Crear configuración de Speech
    this._speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      this._subscriptionKey,
      this._region,
    );
    this._speechConfig.speechRecognitionLanguage = this._language;

    // Configurar audio desde el micrófono
    this._audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    // Crear recognizer
    this._recognizer = new SpeechSDK.SpeechRecognizer(
      this._speechConfig,
      this._audioConfig,
    );

    // Evento: reconociendo (resultados parciales)
    this._recognizer.recognizing = (sender, event) => {
      const text = event.result.text;
      console.log("🎤 Recognizing:", text);

      if (this._onInterim) {
        this._onInterim(text);
      }
    };

    // Evento: reconocido (resultado final)
    this._recognizer.recognized = (sender, event) => {
      if (event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = event.result.text;
        console.log("🎤 Recognized:", text);

        this._lastResult = text;
        this._notifyListeners("result", { text });
      } else if (event.result.reason === SpeechSDK.ResultReason.NoMatch) {
        console.log("🎤 No speech recognized");
      }
    };

    // Evento: cancelado
    this._recognizer.canceled = (sender, event) => {
      console.log("🎤 Recognition canceled:", event.reason);

      if (event.reason === SpeechSDK.CancellationReason.Error) {
        console.error("🎤 Error details:", event.errorDetails);
        this._setState(SpeechState.ERROR);
      }

      this._cleanup();
    };

    // Evento: sesión terminada
    this._recognizer.sessionStopped = (sender, event) => {
      console.log("🎤 Session stopped");

      if (this._state === SpeechState.LISTENING) {
        // La sesión terminó por sí sola (silencio/timeout)
        const finalText = this._lastResult || "";
        this._setState(SpeechState.IDLE);

        if (finalText) {
          this._notifyListeners("result", { text: finalText });
        }
      }

      this._cleanup();
    };

    // Iniciar reconocimiento continuo
    return new Promise((resolve, reject) => {
      this._recognizer.startContinuousRecognitionAsync(
        () => {
          console.log("🎤 Azure Speech SDK started");

          // Auto-stop después del tiempo máximo
          const maxTime =
            CONFIG.AZURE_SPEECH?.MAX_RECORDING_MS || this._maxRecordingMs;
          this._recordingTimeout = setTimeout(() => {
            if (this._state === SpeechState.LISTENING) {
              console.log("🎤 Auto-stop after max recording time");
              this.stopListening();
            }
          }, maxTime);

          resolve();
        },
        (error) => {
          console.error("🎤 Failed to start recognition:", error);
          this._cleanup();
          reject(error);
        },
      );
    });
  }

  /**
   * Limpia los recursos del Azure Speech SDK
   */
  _cleanup() {
    if (this._recognizer) {
      try {
        this._recognizer.close();
      } catch (e) {
        /* ignore */
      }
      this._recognizer = null;
    }
    if (this._audioConfig) {
      this._audioConfig = null;
    }
    if (this._speechConfig) {
      this._speechConfig = null;
    }
  }
}

// Singleton export
export const speechService = new SpeechService();

// También exportar la clase
export { SpeechService };
