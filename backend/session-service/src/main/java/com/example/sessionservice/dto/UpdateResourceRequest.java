package com.example.sessionservice.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateResourceRequest(@NotBlank String resourceId) {}
