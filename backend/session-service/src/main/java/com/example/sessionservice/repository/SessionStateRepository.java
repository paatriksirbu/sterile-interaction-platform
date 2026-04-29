package com.example.sessionservice.repository;

import com.example.sessionservice.model.SessionState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionStateRepository extends JpaRepository<SessionState, String> {
}
