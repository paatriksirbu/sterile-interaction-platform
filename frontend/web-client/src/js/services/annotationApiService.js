import { annotationManager } from '../objects/annotationManager.js';
import { getSessionId } from './sessionContextService.js';
import { API_BASE_URL } from '../config.js';

const RESOURCE_ID = 'surgical-pdf-main';
const VIEWER_TYPE = 'PDF';
const ENDPOINT = API_BASE_URL + '/api/annotations';
const SPEECH_TIMEOUT_MS = 5000;
const FALLBACK_TEXT = 'Anotación creada por gesto';

function postAnnotation(annotationText) {
  var payload = {
    sessionId: getSessionId(),
    resourceId: RESOURCE_ID,
    annotationText: annotationText || FALLBACK_TEXT,
    viewerType: VIEWER_TYPE
  };
  console.log('[ANNOTATION] Sending annotation payload:', JSON.stringify(payload));

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) {
      console.log('[ANNOTATION] Annotation service response:', res.status);
    })
    .catch(function (err) {
      console.warn('[ANNOTATION] POST failed:', err);
    });
}

function recognizeAndPost(annotationId) {
  console.log('[ANNOTATION] Gesture annotation created');

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.log('[ANNOTATION] Web Speech API not available, using fallback');
    annotationManager.updateSpeechText(annotationId, FALLBACK_TEXT);
    console.log('[ANNOTATION] Visual annotation updated with transcript');
    postAnnotation(FALLBACK_TEXT);
    return;
  }

  var recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  console.log('[ANNOTATION] Web Speech started');

  var done = false;
  var timer = setTimeout(function () {
    if (!done) {
      done = true;
      try { recognition.stop(); } catch (e) { /* ignore */ }
      console.log('[ANNOTATION] Speech timeout — using fallback');
      annotationManager.updateSpeechText(annotationId, FALLBACK_TEXT);
      console.log('[ANNOTATION] Visual annotation updated with transcript');
      postAnnotation(FALLBACK_TEXT);
    }
  }, SPEECH_TIMEOUT_MS);

  recognition.onresult = function (event) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    var transcript = event.results[0][0].transcript.trim();
    console.log('[ANNOTATION] Speech transcript captured:', transcript);
    var textUsed = transcript || FALLBACK_TEXT;
    annotationManager.updateSpeechText(annotationId, textUsed);
    console.log('[ANNOTATION] Visual annotation updated with transcript');
    postAnnotation(textUsed);
  };

  recognition.onerror = function (event) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    console.log('[ANNOTATION] Speech error (' + event.error + ') — using fallback');
    annotationManager.updateSpeechText(annotationId, FALLBACK_TEXT);
    console.log('[ANNOTATION] Visual annotation updated with transcript');
    postAnnotation(FALLBACK_TEXT);
  };

  recognition.onend = function () {
    if (!done) {
      done = true;
      clearTimeout(timer);
      console.log('[ANNOTATION] Speech ended with no result — using fallback');
      annotationManager.updateSpeechText(annotationId, FALLBACK_TEXT);
      console.log('[ANNOTATION] Visual annotation updated with transcript');
      postAnnotation(FALLBACK_TEXT);
    }
  };

  try {
    recognition.start();
  } catch (err) {
    done = true;
    clearTimeout(timer);
    console.warn('[ANNOTATION] Speech start failed:', err);
    annotationManager.updateSpeechText(annotationId, FALLBACK_TEXT);
    console.log('[ANNOTATION] Visual annotation updated with transcript');
    postAnnotation(FALLBACK_TEXT);
  }
}

export { recognizeAndPost };
