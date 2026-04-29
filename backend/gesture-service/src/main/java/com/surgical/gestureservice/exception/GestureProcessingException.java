package com.surgical.gestureservice.exception;

public class GestureProcessingException extends RuntimeException {

    public GestureProcessingException(String message) {
        super(message);
    }

    public GestureProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}