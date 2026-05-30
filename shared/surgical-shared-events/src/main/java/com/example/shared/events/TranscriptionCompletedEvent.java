package com.example.shared.events;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record TranscriptionCompletedEvent(
    String transcriptionId,
    String sessionId,
    String recognizedText,
    double confidence,
    Instant completedAt
) implements Serializable {
    public static TranscriptionCompletedEvent of(String sessionId, String recognizedText, double confidence) {
        return new TranscriptionCompletedEvent(
            UUID.randomUUID().toString(),
            sessionId,
            recognizedText,
            confidence,
            Instant.now()
        );
    }
}
