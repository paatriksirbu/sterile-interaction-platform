package com.example.sessionservice.dto;

import com.example.shared.enums.ViewerType;
import jakarta.validation.constraints.NotNull;

public record UpdateViewerRequest(@NotNull ViewerType viewer) {}
