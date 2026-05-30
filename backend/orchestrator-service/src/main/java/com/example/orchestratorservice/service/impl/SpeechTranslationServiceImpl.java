package com.example.orchestratorservice.service.impl;

import com.example.orchestratorservice.config.RabbitConfig;
import com.example.orchestratorservice.mapper.SpeechCommandMapper;
import com.example.orchestratorservice.service.SpeechTranslationService;
import com.example.shared.enums.GestureType;
import com.example.shared.enums.InteractionCommandType;
import com.example.shared.events.InteractionCommandEvent;
import com.example.shared.events.TranscriptionCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SpeechTranslationServiceImpl implements SpeechTranslationService {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public void translate(TranscriptionCompletedEvent event) {
        log.info("[ORCHESTRATOR][SPEECH] Received transcription: id={} session={} text='{}' confidence={}",
                event.transcriptionId(), event.sessionId(), event.recognizedText(), event.confidence());

        Optional<InteractionCommandType> commandOpt = SpeechCommandMapper.toCommandType(event.recognizedText());

        if (commandOpt.isEmpty()) {
            log.info("[ORCHESTRATOR][SPEECH] Unknown text='{}', ignoring.", event.recognizedText());
            return;
        }

        InteractionCommandType commandType = commandOpt.get();
        log.info("[ORCHESTRATOR][SPEECH] Mapped text='{}' -> command={}", event.recognizedText(), commandType);

        InteractionCommandEvent command = InteractionCommandEvent.of(
                event.transcriptionId(),
                event.sessionId(),
                GestureType.UNKNOWN,
                commandType
        );

        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.COMMAND_ROUTING_KEY, command);
        log.info("[ORCHESTRATOR][SPEECH] Published InteractionCommandEvent: id={} session={} command={}",
                command.eventId(), command.sessionId(), command.commandType());
    }
}
