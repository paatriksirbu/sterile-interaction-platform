package com.example.sessionservice.exception;

public class SessionAlreadyExistsException extends RuntimeException {
    public SessionAlreadyExistsException(String sessionId) {
        super("Session already exists: " + sessionId);
    }
}
