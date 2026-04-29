package com.example.sessionservice.controller;

import com.example.sessionservice.service.SessionStateService;
import com.example.shared.dto.SessionContextDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionStateController {

    private final SessionStateService sessionStateService;

    @GetMapping("/{sessionId}")
    public ResponseEntity<SessionContextDTO> getSession(@PathVariable String sessionId) {
        return ResponseEntity.ok(sessionStateService.getSession(sessionId));
    }

    @PostMapping("/{sessionId}")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionContextDTO createSession(@PathVariable String sessionId) {
        return sessionStateService.createSession(sessionId);
    }
}
