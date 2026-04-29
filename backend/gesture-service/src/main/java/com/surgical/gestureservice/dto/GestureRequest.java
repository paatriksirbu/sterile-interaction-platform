package com.surgical.gestureservice.dto;

import com.example.shared.enums.GestureType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GestureRequest(
        @NotBlank String sessionId,
        @NotNull GestureType gestureType,
        @DecimalMin("0.0") @DecimalMax("1.0") double confidence
) {}