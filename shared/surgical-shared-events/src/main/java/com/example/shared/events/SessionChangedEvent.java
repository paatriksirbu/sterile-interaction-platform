package com.example.shared.events;

import com.example.shared.enums.InteractionCommandType;
import com.example.shared.enums.SessionStatus;
import com.example.shared.enums.ViewerType;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record SessionChangedEvent(
        String eventId,
        String sessionId,
        SessionStatus newStatus,
        ViewerType activeViewer,
        InteractionCommandType triggeringCommand,
        Instant changedAt
) implements Serializable {

    public static SessionChangedEvent of(String sessionId,
                                         SessionStatus newStatus,
                                         ViewerType activeViewer,
                                         InteractionCommandType triggeringCommand) {
        return new SessionChangedEvent(
                UUID.randomUUID().toString(),
                sessionId,
                newStatus,
                activeViewer,
                triggeringCommand,
                Instant.now()
        );
    }
}
