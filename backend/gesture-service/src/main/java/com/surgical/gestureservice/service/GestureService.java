package com.surgical.gestureservice.service;

import com.surgical.gestureservice.dto.GestureRequest;
import com.surgical.gestureservice.dto.GestureResponse;

public interface GestureService {
    GestureResponse processGesture(GestureRequest request);
}