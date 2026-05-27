package com.example.sessionservice.controller;

import com.example.sessionservice.dto.ActionRequest;
import com.example.sessionservice.dto.CreateSessionRequest;
import com.example.sessionservice.dto.PatchSessionRequest;
import com.example.sessionservice.dto.UpdateResourceRequest;
import com.example.sessionservice.dto.UpdateViewerRequest;
import com.example.sessionservice.service.SessionStateService;
import com.example.shared.dto.SessionContextDTO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionStateController {

    private final SessionStateService sessionStateService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionContextDTO createSession(@RequestBody(required = false) @Valid CreateSessionRequest request) {
        String sessionId = (request != null && request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId()
                : UUID.randomUUID().toString();
        return sessionStateService.createSession(sessionId);
    }

    @PostMapping("/{sessionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionContextDTO createSessionWithId(@PathVariable String sessionId) {
        return sessionStateService.createSession(sessionId);
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<SessionContextDTO> getSession(@PathVariable String sessionId) {
        return ResponseEntity.ok(sessionStateService.getSession(sessionId));
    }

    @PatchMapping("/{sessionId}")
    public ResponseEntity<SessionContextDTO> patchSession(
            @PathVariable String sessionId,
            @RequestBody @Valid PatchSessionRequest request) {
        return ResponseEntity.ok(sessionStateService.patchSession(sessionId, request));
    }

    @PostMapping("/{sessionId}/viewer")
    public ResponseEntity<SessionContextDTO> updateViewer(
            @PathVariable String sessionId,
            @RequestBody @Valid UpdateViewerRequest request) {
        return ResponseEntity.ok(sessionStateService.updateViewer(sessionId, request));
    }

    @PostMapping("/{sessionId}/resource")
    public ResponseEntity<SessionContextDTO> updateResource(
            @PathVariable String sessionId,
            @RequestBody @Valid UpdateResourceRequest request) {
        return ResponseEntity.ok(sessionStateService.updateResource(sessionId, request));
    }

    @PostMapping("/{sessionId}/action")
    public ResponseEntity<SessionContextDTO> applyAction(
            @PathVariable String sessionId,
            @RequestBody @Valid ActionRequest request) {
        return ResponseEntity.ok(sessionStateService.applyAction(sessionId, request));
    }
}
