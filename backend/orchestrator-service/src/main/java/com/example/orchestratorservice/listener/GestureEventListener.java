package com.example.orchestratorservice.listener;

import com.example.orchestratorservice.config.RabbitConfig;
import com.example.orchestratorservice.service.GestureTranslationService;
import com.example.shared.events.GestureDetectedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class GestureEventListener {

    private final GestureTranslationService gestureTranslationService;

    @RabbitListener(queues = RabbitConfig.GESTURE_QUEUE)
    public void onGestureDetected(GestureDetectedEvent event) {
        log.debug("[ORCHESTRATOR] Message received from queue '{}': eventId={}",
                RabbitConfig.GESTURE_QUEUE, event.gestureEventId());
        gestureTranslationService.translate(event);
    }
}
