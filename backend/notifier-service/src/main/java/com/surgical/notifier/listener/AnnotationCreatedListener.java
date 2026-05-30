package com.surgical.notifier.listener;

import com.example.shared.events.AnnotationCreatedEvent;
import com.surgical.notifier.config.RabbitConfig;
import com.surgical.notifier.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnnotationCreatedListener {

    private final NotificationService notificationService;

    @RabbitListener(queues = RabbitConfig.ANNOTATION_QUEUE)
    public void onAnnotationCreated(AnnotationCreatedEvent event) {
        log.debug("[NOTIFIER][ANNOTATION] Received from queue={} annotationId={}",
            RabbitConfig.ANNOTATION_QUEUE, event.annotationId());
        notificationService.processAnnotation(event);
    }
}
