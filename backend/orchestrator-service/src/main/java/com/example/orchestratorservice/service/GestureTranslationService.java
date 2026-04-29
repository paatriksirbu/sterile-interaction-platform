package com.example.orchestratorservice.service;

import com.example.shared.events.GestureDetectedEvent;

public interface GestureTranslationService {
    void translate(GestureDetectedEvent event);
}
