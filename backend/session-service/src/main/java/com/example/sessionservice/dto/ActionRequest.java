package com.example.sessionservice.dto;

import com.example.shared.enums.InteractionCommandType;
import jakarta.validation.constraints.NotNull;

public record ActionRequest(@NotNull InteractionCommandType action) {}
