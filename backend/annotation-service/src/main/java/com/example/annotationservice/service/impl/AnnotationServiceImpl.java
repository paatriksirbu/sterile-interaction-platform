package com.example.annotationservice.service.impl;

import com.example.annotationservice.config.RabbitConfig;
import com.example.annotationservice.dto.AnnotationRequest;
import com.example.annotationservice.service.AnnotationService;
import com.example.shared.enums.ViewerType;
import com.example.shared.events.AnnotationCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnnotationServiceImpl implements AnnotationService {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public void createAnnotation(AnnotationRequest request) {
        ViewerType viewerType = request.viewerType() != null ? request.viewerType() : ViewerType.UNKNOWN;
        AnnotationCreatedEvent event = AnnotationCreatedEvent.of(
            request.sessionId(),
            request.resourceId(),
            request.annotationText(),
            viewerType
        );
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ANNOTATION_ROUTING_KEY, event);
        log.info("[annotation-service] Published AnnotationCreatedEvent: id={} session={} resource={} viewer={}",
            event.annotationId(), event.sessionId(), event.resourceId(), event.viewerType());
    }
}
