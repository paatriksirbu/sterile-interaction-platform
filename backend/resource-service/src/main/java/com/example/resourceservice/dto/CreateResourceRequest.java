package com.example.resourceservice.dto;

import com.example.shared.enums.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateResourceRequest(
        @NotNull ResourceType type,
        @NotBlank String title,
        String description,
        @NotBlank String url,
        String thumbnailUrl
) {}