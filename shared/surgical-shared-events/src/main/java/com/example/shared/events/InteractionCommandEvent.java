package com.example.shared.events;

import com.example.shared.enums.GestureType;
import com.example.shared.enums.InteractionCommandType;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record InteractionCommandEvent(
        String eventId,
        String originEventId,
        String sessionId,
        GestureType sourceGesture,
        InteractionCommandType commandType,
        Instant createdAt
) implements Serializable {
    public static InteractionCommandEvent of(String originEventId, String sessionId, GestureType sourceGesture, InteractionCommandType commandType) {
        return new InteractionCommandEvent(
                UUID.randomUUID().toString(),
                originEventId,
                sessionId,
                sourceGesture,
                commandType,
                Instant.now()
        );
    }
}
