package com.example.orchestratorservice.service.impl;

import com.example.orchestratorservice.config.RabbitConfig;
import com.example.orchestratorservice.mapper.GestureCommandMapper;
import com.example.orchestratorservice.service.GestureTranslationService;
import com.example.shared.enums.GestureType;
import com.example.shared.enums.InteractionCommandType;
import com.example.shared.events.GestureDetectedEvent;
import com.example.shared.events.InteractionCommandEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class GestureTranslationServiceImpl implements GestureTranslationService {

    private final RabbitTemplate rabbitTemplate;

    @Value("${orchestrator.gesture.confidence-threshold:0.6}")
    private double confidenceThreshold;

    @Override
    public void translate(GestureDetectedEvent event) {
        log.debug("[ORCHESTRATOR] Received gesture: eventId={}, sessionId={}, gesture={}, confidence={}",
                event.gestureEventId(), event.sessionId(), event.gestureType(), event.confidence());

        if (event.confidence() < confidenceThreshold) {
            log.warn("[ORCHESTRATOR] Discarding low-confidence gesture: eventId={}, gesture={}, confidence={} (threshold={})",
                    event.gestureEventId(), event.gestureType(), event.confidence(), confidenceThreshold);
            return;
        }

        if (event.gestureType() == GestureType.UNKNOWN) {
            log.debug("[ORCHESTRATOR] Skipping UNKNOWN gesture: eventId={}, sessionId={}",
                    event.gestureEventId(), event.sessionId());
            return;
        }

        InteractionCommandType commandType = GestureCommandMapper.toCommandType(event.gestureType());

        InteractionCommandEvent command = InteractionCommandEvent.of(
                event.gestureEventId(),
                event.sessionId(),
                event.gestureType(),
                commandType
        );

        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.COMMAND_ROUTING_KEY, command);

        log.info("[ORCHESTRATOR] {} -> {} | sessionId={}, originEventId={}, newEventId={}",
                event.gestureType(), commandType,
                event.sessionId(), event.gestureEventId(), command.eventId());
    }
}
