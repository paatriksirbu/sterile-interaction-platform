package com.surgical.notifier.service;

import com.example.shared.events.AnnotationCreatedEvent;
import com.example.shared.events.InteractionCommandEvent;
import com.surgical.notifier.dto.NotificationMessage;

import java.util.List;

public interface NotificationService {
    void processCommand(InteractionCommandEvent event);
    void processAnnotation(AnnotationCreatedEvent event);
    List<NotificationMessage> getAll();
    void clearAll();
}
