package com.surgical.gestureservice.controller;

import com.surgical.gestureservice.dto.GestureRequest;
import com.surgical.gestureservice.dto.GestureResponse;
import com.surgical.gestureservice.service.GestureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gestures")
@RequiredArgsConstructor
public class GestureController {

    private final GestureService gestureService;

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public GestureResponse publishGesture(@Valid @RequestBody GestureRequest request) {
        return gestureService.processGesture(request);
    }
}
