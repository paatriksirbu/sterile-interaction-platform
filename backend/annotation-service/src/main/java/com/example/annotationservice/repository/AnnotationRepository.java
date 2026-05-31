package com.example.annotationservice.repository;

import com.example.annotationservice.entity.AnnotationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AnnotationRepository extends JpaRepository<AnnotationEntity, UUID> {
    List<AnnotationEntity> findBySessionIdOrderByCreatedAtAsc(String sessionId);
}
