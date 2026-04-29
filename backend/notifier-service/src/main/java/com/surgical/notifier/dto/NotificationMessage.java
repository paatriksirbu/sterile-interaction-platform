package com.surgical.notifier.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationMessage(
        String id,
        String type,
        String message,
        Instant timestamp
) {
    public static NotificationMessage of(String type, String message) {
        return new NotificationMessage(UUID.randomUUID().toString(), type, message, Instant.now());
    }
}
