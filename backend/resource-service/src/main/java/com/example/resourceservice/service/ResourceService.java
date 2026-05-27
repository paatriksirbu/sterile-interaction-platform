package com.example.resourceservice.service;

import com.example.resourceservice.dto.CreateResourceRequest;
import com.example.resourceservice.dto.ResourceDTO;
import com.example.resourceservice.dto.UpdateResourceRequest;
import com.example.shared.enums.ResourceType;

import java.util.List;

public interface ResourceService {

    List<ResourceDTO> getAllResources();

    ResourceDTO getResourceById(String resourceId);

    List<ResourceDTO> getResourcesByType(ResourceType type);

    ResourceDTO createResource(CreateResourceRequest request);

    ResourceDTO updateResource(String resourceId, UpdateResourceRequest request);

    void deleteResource(String resourceId);
}