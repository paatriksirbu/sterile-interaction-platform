package com.example.shared.events;

import com.example.shared.enums.GestureType;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record GestureDetectedEvent (
        String gestureEventId,
        String sessionId,
        GestureType gestureType,
        double confidence,
        Instant detectedAt
) implements Serializable {
    public static GestureDetectedEvent of(String sessionId, GestureType gestureType, double confidence) {
        return new GestureDetectedEvent(
                UUID.randomUUID().toString(),
                sessionId,
                gestureType,
                confidence,
                Instant.now()
        );
    }
}
