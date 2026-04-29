package com.example.sessionservice.service.impl;

import com.example.sessionservice.config.RabbitConfig;
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
                .orElseGet(() -> {
                    log.info("[SESSION] Unknown session, auto-creating: sessionId={}", event.sessionId());
                    return buildNewSession(event.sessionId());
                });

        if (session.getStatus() == SessionStatus.LOCKED
                && event.commandType() != InteractionCommandType.LOCK) {
            log.warn("[SESSION] Command rejected — session is LOCKED: type={}, sessionId={}",
                    event.commandType(), event.sessionId());
            return;
        }

        applyCommand(session, event.commandType());
        session.setLastUpdatedAt(Instant.now());
        sessionStateRepository.save(session);

        SessionChangedEvent changedEvent = SessionChangedEvent.of(
                session.getSessionId(),
                session.getStatus(),
                session.getActiveViewer(),
                event.commandType()
        );
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.SESSION_CHANGED_ROUTING_KEY, changedEvent);

        log.info("[SESSION] State updated — sessionId={}, status={}, viewer={}, lastCommand={}, newEventId={}",
                session.getSessionId(), session.getStatus(), session.getActiveViewer(),
                session.getLastCommand(), changedEvent.eventId());
    }

    @Override
    @Transactional(readOnly = true)
    public SessionContextDTO getSession(String sessionId) {
        SessionState session = sessionStateRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        return toDto(session);
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

    private void applyCommand(SessionState session, InteractionCommandType commandType) {
        if (commandType == InteractionCommandType.LOCK) {
            SessionStatus toggled = session.getStatus() == SessionStatus.LOCKED
                    ? SessionStatus.ACTIVE
                    : SessionStatus.LOCKED;
            session.setStatus(toggled);
            log.info("[SESSION] Lock toggled: sessionId={}, newStatus={}", session.getSessionId(), toggled);
        }
        session.setLastCommand(commandType);
    }

    private SessionState buildNewSession(String sessionId) {
        return SessionState.builder()
                .sessionId(sessionId)
                .activeViewer(ViewerType.DASHBOARD)
                .status(SessionStatus.ACTIVE)
                .lastUpdatedAt(Instant.now())
                .build();
    }

    private SessionContextDTO toDto(SessionState s) {
        return SessionContextDTO.builder()
                .sessionId(s.getSessionId())
                .activeViewer(s.getActiveViewer())
                .status(s.getStatus())
                .activeResourceId(s.getActiveResourceId())
                .build();
    }
}
