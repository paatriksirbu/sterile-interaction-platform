package com.example.annotationservice.dto;

import com.example.shared.enums.ViewerType;

public record AnnotationRequest(
    String sessionId,
    String resourceId,
    String annotationText,
    ViewerType viewerType
) {}
