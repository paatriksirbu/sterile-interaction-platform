package com.example.orchestratorservice.listener;

import com.example.orchestratorservice.config.RabbitConfig;
import com.example.orchestratorservice.service.SpeechTranslationService;
import com.example.shared.events.TranscriptionCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TranscriptionEventListener {

    private final SpeechTranslationService speechTranslationService;

    @RabbitListener(queues = RabbitConfig.TRANSCRIPTION_QUEUE)
    public void onTranscriptionCompleted(TranscriptionCompletedEvent event) {
        log.debug("[ORCHESTRATOR][SPEECH] Received from queue={} transcriptionId={}",
                RabbitConfig.TRANSCRIPTION_QUEUE, event.transcriptionId());
        speechTranslationService.translate(event);
    }
}
