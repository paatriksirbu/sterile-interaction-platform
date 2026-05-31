package com.example.annotationservice.service;

import com.example.annotationservice.dto.AnnotationRequest;
import com.example.annotationservice.entity.AnnotationEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnnotationService {
    AnnotationEntity createAnnotation(AnnotationRequest request);
    List<AnnotationEntity> findBySessionId(String sessionId);
    Optional<AnnotationEntity> findById(UUID id);
}
