package com.example.annotationservice.service.impl;

import com.example.annotationservice.config.RabbitConfig;
import com.example.annotationservice.dto.AnnotationRequest;
import com.example.annotationservice.entity.AnnotationEntity;
import com.example.annotationservice.repository.AnnotationRepository;
import com.example.annotationservice.service.AnnotationService;
import com.example.shared.enums.ViewerType;
import com.example.shared.events.AnnotationCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnnotationServiceImpl implements AnnotationService {

    private final RabbitTemplate rabbitTemplate;
    private final AnnotationRepository annotationRepository;

    @Override
    @Transactional
    public AnnotationEntity createAnnotation(AnnotationRequest request) {
        ViewerType viewerType = request.viewerType() != null ? request.viewerType() : ViewerType.UNKNOWN;

        AnnotationEntity entity = new AnnotationEntity();
        entity.setSessionId(request.sessionId());
        entity.setResourceId(request.resourceId());
        entity.setAnnotationText(request.annotationText());
        entity.setViewerType(viewerType.name());

        AnnotationEntity saved = annotationRepository.save(entity);
        log.info("[annotation-service] Annotation persisted: id={} session={} resource={} viewer={}",
            saved.getId(), saved.getSessionId(), saved.getResourceId(), saved.getViewerType());

        AnnotationCreatedEvent event = AnnotationCreatedEvent.of(
            request.sessionId(),
            request.resourceId(),
            request.annotationText(),
            viewerType
        );
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ANNOTATION_ROUTING_KEY, event);
        log.info("[annotation-service] Published AnnotationCreatedEvent: id={} session={} resource={} viewer={}",
            event.annotationId(), event.sessionId(), event.resourceId(), event.viewerType());

        return saved;
    }

    @Override
    public List<AnnotationEntity> findBySessionId(String sessionId) {
        return annotationRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    @Override
    public Optional<AnnotationEntity> findById(UUID id) {
        return annotationRepository.findById(id);
    }
}
