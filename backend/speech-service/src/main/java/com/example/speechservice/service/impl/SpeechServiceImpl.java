package com.example.speechservice.service.impl;

import com.example.shared.events.TranscriptionCompletedEvent;
import com.example.speechservice.config.RabbitConfig;
import com.example.speechservice.dto.TranscriptionRequest;
import com.example.speechservice.service.SpeechService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SpeechServiceImpl implements SpeechService {

    private final RabbitTemplate rabbitTemplate;

    @Override
    public void processTranscription(TranscriptionRequest request) {
        TranscriptionCompletedEvent event = TranscriptionCompletedEvent.of(
            request.sessionId(),
            request.recognizedText(),
            request.confidence()
        );
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.TRANSCRIPTION_ROUTING_KEY, event);
        log.info("[speech-service] Published TranscriptionCompletedEvent: id={} session={} text='{}' confidence={}",
            event.transcriptionId(), event.sessionId(), event.recognizedText(), event.confidence());
    }
}
