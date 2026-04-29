package com.surgical.gestureservice.service.impl;

import com.example.shared.events.GestureDetectedEvent;
import com.surgical.gestureservice.config.RabbitConfig;
import com.surgical.gestureservice.dto.GestureRequest;
import com.surgical.gestureservice.dto.GestureResponse;
import com.surgical.gestureservice.exception.GestureProcessingException;
import com.surgical.gestureservice.service.GestureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class GestureServiceImpl implements GestureService {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public GestureResponse processGesture(GestureRequest request) {
        GestureDetectedEvent event = GestureDetectedEvent.of(
                request.sessionId(),
                request.gestureType(),
                request.confidence()
        );

        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.GESTURE_ROUTING_KEY, event);
            log.info("Published GestureDetectedEvent: eventId={}, sessionId={}, gesture={}, confidence={}",
                    event.gestureEventId(), event.sessionId(), event.gestureType(), event.confidence());
        } catch (AmqpException e) {
            throw new GestureProcessingException("Failed to publish gesture event for session " + request.sessionId(), e);
        }

        return new GestureResponse(
                event.gestureEventId(),
                event.sessionId(),
                event.gestureType(),
                event.confidence(),
                event.detectedAt()
        );
    }
}