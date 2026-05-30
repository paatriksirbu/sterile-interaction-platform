package com.example.speechservice.dto;

public record TranscriptionRequest(
    String sessionId,
    String recognizedText,
    double confidence
) {}
