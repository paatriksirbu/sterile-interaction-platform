package com.example.speechservice.service;

import com.example.speechservice.dto.TranscriptionRequest;

public interface SpeechService {
    void processTranscription(TranscriptionRequest request);
}
