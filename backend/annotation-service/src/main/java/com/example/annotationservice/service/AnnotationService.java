package com.example.annotationservice.service;

import com.example.annotationservice.dto.AnnotationRequest;

public interface AnnotationService {
    void createAnnotation(AnnotationRequest request);
}
