package com.example.sessionservice.dto;

import jakarta.validation.constraints.Size;

public record CreateSessionRequest(
        @Size(max = 100) String sessionId
) {}
