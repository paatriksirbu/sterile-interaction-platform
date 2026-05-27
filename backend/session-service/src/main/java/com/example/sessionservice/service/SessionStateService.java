package com.example.sessionservice.service;

import com.example.sessionservice.dto.PatchSessionRequest;
import com.example.sessionservice.dto.UpdateResourceRequest;
import com.example.sessionservice.dto.UpdateViewerRequest;
import com.example.sessionservice.dto.ActionRequest;
import com.example.shared.dto.SessionContextDTO;
import com.example.shared.events.InteractionCommandEvent;

public interface SessionStateService {
    void handleCommand(InteractionCommandEvent event);
    SessionContextDTO getSession(String sessionId);
    SessionContextDTO createSession(String sessionId);
    SessionContextDTO patchSession(String sessionId, PatchSessionRequest request);
    SessionContextDTO updateViewer(String sessionId, UpdateViewerRequest request);
    SessionContextDTO updateResource(String sessionId, UpdateResourceRequest request);
    SessionContextDTO applyAction(String sessionId, ActionRequest request);
}
