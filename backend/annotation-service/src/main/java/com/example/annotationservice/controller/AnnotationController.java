package com.example.annotationservice.controller;

import com.example.annotationservice.dto.AnnotationRequest;
import com.example.annotationservice.entity.AnnotationEntity;
import com.example.annotationservice.service.AnnotationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/annotations")
@RequiredArgsConstructor
public class AnnotationController {

    private final AnnotationService annotationService;

    @PostMapping
    public ResponseEntity<Void> createAnnotation(@RequestBody AnnotationRequest request) {
        if (request.sessionId() == null || request.sessionId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (request.annotationText() == null || request.annotationText().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        log.info("[annotation-service] Received annotation request: session={} resource={} text='{}'",
            request.sessionId(), request.resourceId(), request.annotationText());
        annotationService.createAnnotation(request);
        return ResponseEntity.accepted().build();
    }

    @GetMapping
    public ResponseEntity<List<AnnotationEntity>> getBySession(
            @RequestParam String sessionId) {
        List<AnnotationEntity> annotations = annotationService.findBySessionId(sessionId);
        return ResponseEntity.ok(annotations);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnnotationEntity> getById(@PathVariable UUID id) {
        return annotationService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
