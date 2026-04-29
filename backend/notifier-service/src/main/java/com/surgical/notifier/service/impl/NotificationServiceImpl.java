package com.surgical.notifier.service.impl;

import com.example.shared.events.InteractionCommandEvent;
import com.surgical.notifier.dto.NotificationMessage;
import com.surgical.notifier.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

@Slf4j
@Service
public class NotificationServiceImpl implements NotificationService {

    private static final int MAX_SIZE = 50;

    private final Deque<NotificationMessage> store = new ConcurrentLinkedDeque<>();

    @Override
    public void processCommand(InteractionCommandEvent event) {
        NotificationMessage notification = toNotification(event);
        if (notification == null) {
            log.debug("[NOTIFIER] Skipping NO_OP command: sessionId={}", event.sessionId());
            return;
        }

        store.addFirst(notification);
        if (store.size() > MAX_SIZE) {
            store.pollLast();
        }

        log.info("[NOTIFIER] {} | type={}, sessionId={}, gesture={}, notificationId={}",
                notification.message(), notification.type(),
                event.sessionId(), event.sourceGesture(), notification.id());

        pushToFrontend(notification);
    }

    @Override
    public List<NotificationMessage> getAll() {
        return new ArrayList<>(store);
    }

    @Override
    public void clearAll() {
        store.clear();
        log.info("[NOTIFIER] Notification store cleared");
    }

    private NotificationMessage toNotification(InteractionCommandEvent event) {
        return switch (event.commandType()) {
            case SELECT   -> NotificationMessage.of("ACTION",  "Elemento seleccionado");
            case NAVIGATE -> NotificationMessage.of("ACTION",  "Navegación activada");
            case LOCK     -> NotificationMessage.of("WARNING", "Sistema bloqueado/desbloqueado");
            case NO_OP    -> null;
        };
    }

    // Hook for WebSocket push — activate WebSocketConfig and inject SimpMessagingTemplate here
    private void pushToFrontend(NotificationMessage notification) {
        log.debug("[NOTIFIER] pushToFrontend: id={}, type={}", notification.id(), notification.type());
    }
}
