package com.example.speechservice.controller;

import com.example.speechservice.dto.TranscriptionRequest;
import com.example.speechservice.service.SpeechService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/speech")
@RequiredArgsConstructor
public class SpeechController {

    private final SpeechService speechService;

    @PostMapping("/transcriptions")
    public ResponseEntity<Void> submitTranscription(@RequestBody TranscriptionRequest request) {
        if (request.sessionId() == null || request.sessionId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (request.recognizedText() == null || request.recognizedText().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        log.info("[speech-service] Received transcription request: session={} text='{}'",
            request.sessionId(), request.recognizedText());
        speechService.processTranscription(request);
        return ResponseEntity.accepted().build();
    }
}
