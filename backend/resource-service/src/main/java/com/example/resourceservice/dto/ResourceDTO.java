package com.example.resourceservice.dto;

import com.example.shared.enums.ResourceType;

import java.time.Instant;

public record ResourceDTO(
        String id,
        ResourceType type,
        String title,
        String description,
        String url,
        String thumbnailUrl,
        Instant createdAt,
        Instant updatedAt
) {}