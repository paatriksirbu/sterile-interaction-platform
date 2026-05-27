package com.example.resourceservice.dto;

import com.example.shared.enums.ResourceType;

public record UpdateResourceRequest(
        ResourceType type,
        String title,
        String description,
        String url,
        String thumbnailUrl
) {}