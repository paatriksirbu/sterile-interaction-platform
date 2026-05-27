package com.example.resourceservice.model;

import com.example.shared.enums.ResourceType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Resource {

    private String id;
    private ResourceType type;
    private String title;
    private String description;
    private String url;
    private String thumbnailUrl;
    private Instant createdAt;
    private Instant updatedAt;
}