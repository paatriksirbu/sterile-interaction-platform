package com.example.shared.dto;

import com.example.shared.enums.InteractionCommandType;
import com.example.shared.enums.SessionStatus;
import com.example.shared.enums.ViewerType;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SessionContextDTO {
    private String sessionId;
    private ViewerType activeViewer;
    private SessionStatus status;
    private String activeResourceId;
    private InteractionCommandType lastAction;
    private Instant createdAt;
    private Instant updatedAt;
}