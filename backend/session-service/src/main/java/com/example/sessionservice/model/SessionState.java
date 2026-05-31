package com.example.sessionservice.model;

import com.example.shared.enums.InteractionCommandType;
import com.example.shared.enums.SessionStatus;
import com.example.shared.enums.ViewerType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "sessions")
public class SessionState {

    @Id
    @Column(name = "session_id")
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ViewerType activeViewer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status;

    @Column(name = "active_resource_id")
    private String activeResourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_action")
    private InteractionCommandType lastAction;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;
}
