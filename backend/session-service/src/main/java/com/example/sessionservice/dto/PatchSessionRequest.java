package com.example.sessionservice.dto;

import com.example.shared.enums.InteractionCommandType;
import com.example.shared.enums.SessionStatus;
import com.example.shared.enums.ViewerType;

public record PatchSessionRequest(
        SessionStatus status,
        ViewerType activeViewer,
        String activeResourceId,
        InteractionCommandType lastAction
) {}
