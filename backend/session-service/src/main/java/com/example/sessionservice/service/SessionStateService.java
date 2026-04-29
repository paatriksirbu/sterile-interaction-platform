package com.example.sessionservice.service;

import com.example.shared.dto.SessionContextDTO;
import com.example.shared.events.InteractionCommandEvent;

public interface SessionStateService {
    void handleCommand(InteractionCommandEvent event);
    SessionContextDTO getSession(String sessionId);
    SessionContextDTO createSession(String sessionId);
}
