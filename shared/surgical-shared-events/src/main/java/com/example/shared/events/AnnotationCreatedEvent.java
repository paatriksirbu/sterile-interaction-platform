package com.example.shared.events;

import com.example.shared.enums.ViewerType;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record AnnotationCreatedEvent(
    String annotationId,
    String sessionId,
    String resourceId,
    String annotationText,
    ViewerType viewerType,
    Instant createdAt
) implements Serializable {
    public static AnnotationCreatedEvent of(String sessionId, String resourceId,
                                             String annotationText, ViewerType viewerType) {
        return new AnnotationCreatedEvent(
            UUID.randomUUID().toString(),
            sessionId,
            resourceId,
            annotationText,
            viewerType,
            Instant.now()
        );
    }
}
