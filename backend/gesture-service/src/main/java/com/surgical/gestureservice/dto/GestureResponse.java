package com.surgical.gestureservice.dto;

import com.example.shared.enums.GestureType;

import java.time.Instant;

public record GestureResponse(
        String gestureEventId,
        String sessionId,
        GestureType gestureType,
        double confidence,
        Instant detectedAt
) {}