package com.surgical.notifier.controller;

import com.surgical.notifier.dto.NotificationMessage;
import com.surgical.notifier.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<NotificationMessage>> getAll() {
        return ResponseEntity.ok(notificationService.getAll());
    }

    @DeleteMapping
    public ResponseEntity<Void> clearAll() {
        notificationService.clearAll();
        return ResponseEntity.noContent().build();
    }
}
