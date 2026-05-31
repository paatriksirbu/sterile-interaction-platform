package com.example.sessionservice.service.impl;

import com.example.sessionservice.config.RabbitConfig;
import com.example.sessionservice.dto.ActionRequest;
import com.example.sessionservice.dto.PatchSessionRequest;
import com.example.sessionservice.dto.UpdateResourceRequest;
import com.example.sessionservice.dto.UpdateViewerRequest;
import com.example.sessionservice.exception.SessionAlreadyExistsException;
import com.example.sessionservice.exception.SessionNotFoundException;
import com.example.sessionservice.model.SessionState;
import com.example.sessionservice.repository.SessionStateRepository;
import com.example.sessionservice.service.SessionStateService;
import com.example.shared.dto.SessionContextDTO;
import com.example.shared.enums.InteractionCommandType;
import com.example.shared.enums.SessionStatus;
import com.example.shared.enums.ViewerType;
import com.example.shared.events.InteractionCommandEvent;
import com.example.shared.events.SessionChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionStateServiceImpl implements SessionStateService {

    private final SessionStateRepository sessionStateRepository;
    private final RabbitTemplate rabbitTemplate;

    @Override
    @Transactional
    public void handleCommand(InteractionCommandEvent event) {
        log.debug("[SESSION] Handling command: type={}, sessionId={}, originEventId={}",
                event.commandType(), event.sessionId(), event.originEventId());

        SessionState session = sessionStateRepository.findById(event.sessionId())
                .map(s -> {
                    log.info("[session-service] Session loaded from DB: sessionId={} status={} viewer={}",
                            s.getSessionId(), s.getStatus(), s.getActiveViewer());
                    return s;
                })
                .orElseGet(() -> {
                    log.info("[session-service] Session not found, auto-creating: sessionId={}", event.sessionId());
                    return buildNewSession(event.sessionId());
                });

        if (session.getStatus() == SessionStatus.LOCKED
                && event.commandType() != InteractionCommandType.LOCK) {
            log.warn("[SESSION] Command rejected — session is LOCKED: type={}, sessionId={}",
                    event.commandType(), event.sessionId());
            return;
        }

        applyCommandLogic(session, event.commandType());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);
        log.info("[session-service] Session persisted to PostgreSQL: sessionId={} status={} viewer={} lastAction={}",
                session.getSessionId(), session.getStatus(), session.getActiveViewer(), session.getLastAction());

        publishSessionChanged(session, event.commandType());

        log.info("[SESSION] State updated — sessionId={}, status={}, viewer={}, lastAction={}",
                session.getSessionId(), session.getStatus(), session.getActiveViewer(), session.getLastAction());
    }

    @Override
    @Transactional(readOnly = true)
    public SessionContextDTO getSession(String sessionId) {
        return toDto(findOrThrow(sessionId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<SessionContextDTO> findAll() {
        return sessionStateRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public SessionContextDTO createSession(String sessionId) {
        if (sessionStateRepository.existsById(sessionId)) {
            throw new SessionAlreadyExistsException(sessionId);
        }
        SessionState saved = sessionStateRepository.save(buildNewSession(sessionId));
        log.info("[SESSION] New session created: sessionId={}", sessionId);
        return toDto(saved);
    }

    @Override
    @Transactional
    public SessionContextDTO patchSession(String sessionId, PatchSessionRequest request) {
        SessionState session = findOrThrow(sessionId);
        if (request.status() != null) session.setStatus(request.status());
        if (request.activeViewer() != null) session.setActiveViewer(request.activeViewer());
        if (request.activeResourceId() != null) session.setActiveResourceId(request.activeResourceId());
        if (request.lastAction() != null) session.setLastAction(request.lastAction());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);
        log.info("[SESSION] Session patched: sessionId={}, status={}, viewer={}", sessionId, session.getStatus(), session.getActiveViewer());
        return toDto(session);
    }

    @Override
    @Transactional
    public SessionContextDTO updateViewer(String sessionId, UpdateViewerRequest request) {
        SessionState session = findOrThrow(sessionId);
        ViewerType previous = session.getActiveViewer();
        session.setActiveViewer(request.viewer());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);
        publishSessionChanged(session, session.getLastAction());
        log.info("[SESSION] Viewer updated: sessionId={}, {} -> {}", sessionId, previous, request.viewer());
        return toDto(session);
    }

    @Override
    @Transactional
    public SessionContextDTO updateResource(String sessionId, UpdateResourceRequest request) {
        SessionState session = findOrThrow(sessionId);
        session.setActiveResourceId(request.resourceId());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);
        log.info("[SESSION] Resource updated: sessionId={}, resourceId={}", sessionId, request.resourceId());
        return toDto(session);
    }

    @Override
    @Transactional
    public SessionContextDTO applyAction(String sessionId, ActionRequest request) {
        SessionState session = findOrThrow(sessionId);

        if (session.getStatus() == SessionStatus.LOCKED
                && request.action() != InteractionCommandType.LOCK) {
            log.warn("[SESSION] Action rejected — session is LOCKED: action={}, sessionId={}", request.action(), sessionId);
            return toDto(session);
        }

        applyCommandLogic(session, request.action());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);
        publishSessionChanged(session, request.action());
        log.info("[SESSION] Action applied: sessionId={}, action={}, status={}", sessionId, request.action(), session.getStatus());
        return toDto(session);
    }

    private void applyCommandLogic(SessionState session, InteractionCommandType commandType) {
        switch (commandType) {
            case LOCK -> {
                SessionStatus toggled = session.getStatus() == SessionStatus.LOCKED
                        ? SessionStatus.ACTIVE
                        : SessionStatus.LOCKED;
                session.setStatus(toggled);
                log.info("[SESSION] Lock toggled: sessionId={}, newStatus={}", session.getSessionId(), toggled);
            }
            case PAUSE -> {
                session.setStatus(SessionStatus.PAUSED);
                log.info("[SESSION] Session paused: sessionId={}", session.getSessionId());
            }
            case SELECT, NEXT, PREVIOUS, NAVIGATE -> {
                if (session.getStatus() == SessionStatus.PAUSED) {
                    session.setStatus(SessionStatus.ACTIVE);
                    log.info("[SESSION] Session resumed by action {}: sessionId={}", commandType, session.getSessionId());
                }
            }
            default -> { /* NO_OP: no state change */ }
        }
        session.setLastAction(commandType);
    }

    private void publishSessionChanged(SessionState session, InteractionCommandType triggeringCommand) {
        SessionChangedEvent event = SessionChangedEvent.of(
                session.getSessionId(),
                session.getStatus(),
                session.getActiveViewer(),
                triggeringCommand
        );
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.SESSION_CHANGED_ROUTING_KEY, event);
        log.debug("[SESSION] SessionChangedEvent published: eventId={}", event.eventId());
    }

    private SessionState findOrThrow(String sessionId) {
        SessionState s = sessionStateRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        log.info("[session-service] Session loaded from DB: sessionId={} status={} viewer={}",
                s.getSessionId(), s.getStatus(), s.getActiveViewer());
        return s;
    }

    private SessionState buildNewSession(String sessionId) {
        Instant now = Instant.now();
        return SessionState.builder()
                .sessionId(sessionId)
                .activeViewer(ViewerType.DASHBOARD)
                .status(SessionStatus.ACTIVE)
                .createdAt(now)
                .lastUpdatedAt(now)
                .build();
    }

    private SessionContextDTO toDto(SessionState s) {
        return SessionContextDTO.builder()
                .sessionId(s.getSessionId())
                .activeViewer(s.getActiveViewer())
                .status(s.getStatus())
                .activeResourceId(s.getActiveResourceId())
                .lastAction(s.getLastAction())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getLastUpdatedAt())
                .build();
    }
}
