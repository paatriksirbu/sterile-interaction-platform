package com.example.orchestratorservice.service;

import com.example.shared.events.TranscriptionCompletedEvent;

public interface SpeechTranslationService {
    void translate(TranscriptionCompletedEvent event);
}
