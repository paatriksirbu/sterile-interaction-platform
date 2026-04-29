package com.surgical.notifier.listener;

import com.example.shared.events.InteractionCommandEvent;
import com.surgical.notifier.config.RabbitConfig;
import com.surgical.notifier.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InteractionCommandListener {

    private final NotificationService notificationService;

    @RabbitListener(queues = RabbitConfig.COMMAND_QUEUE)
    public void onInteractionCommand(InteractionCommandEvent event) {
        log.debug("[NOTIFIER] Message received from '{}': commandType={}, sessionId={}",
                RabbitConfig.COMMAND_QUEUE, event.commandType(), event.sessionId());
        notificationService.processCommand(event);
    }
}
