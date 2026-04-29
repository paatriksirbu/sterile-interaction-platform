package com.example.sessionservice.listener;

import com.example.sessionservice.config.RabbitConfig;
import com.example.sessionservice.service.SessionStateService;
import com.example.shared.events.InteractionCommandEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InteractionCommandListener {

    private final SessionStateService sessionStateService;

    @RabbitListener(queues = RabbitConfig.COMMAND_QUEUE)
    public void onInteractionCommand(InteractionCommandEvent event) {
        log.debug("[SESSION] Message received from '{}': commandType={}, sessionId={}",
                RabbitConfig.COMMAND_QUEUE, event.commandType(), event.sessionId());
        sessionStateService.handleCommand(event);
    }
}
