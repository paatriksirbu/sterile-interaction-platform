package com.example.resourceservice.service.impl;

import com.example.resourceservice.dto.CreateResourceRequest;
import com.example.resourceservice.dto.ResourceDTO;
import com.example.resourceservice.dto.UpdateResourceRequest;
import com.example.resourceservice.exception.ResourceNotFoundException;
import com.example.resourceservice.model.Resource;
import com.example.resourceservice.repository.ResourceRepository;
import com.example.resourceservice.service.ResourceService;
import com.example.shared.enums.ResourceType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResourceServiceImpl implements ResourceService {

    private final ResourceRepository resourceRepository;

    @Override
    public List<ResourceDTO> getAllResources() {
        List<ResourceDTO> resources = resourceRepository.findAll().stream()
                .map(this::toDto)
                .toList();
        log.debug("[RESOURCE] Listing all resources: count={}", resources.size());
        return resources;
    }

    @Override
    public ResourceDTO getResourceById(String resourceId) {
        Resource resource = findOrThrow(resourceId);
        log.debug("[RESOURCE] Found resource: id={}, type={}", resource.getId(), resource.getType());
        return toDto(resource);
    }

    @Override
    public List<ResourceDTO> getResourcesByType(ResourceType type) {
        List<ResourceDTO> resources = resourceRepository.findByType(type).stream()
                .map(this::toDto)
                .toList();
        log.debug("[RESOURCE] Listing resources by type={}: count={}", type, resources.size());
        return resources;
    }

    @Override
    public ResourceDTO createResource(CreateResourceRequest request) {
        Instant now = Instant.now();
        Resource resource = Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(request.type())
                .title(request.title())
                .description(request.description())
                .url(request.url())
                .thumbnailUrl(request.thumbnailUrl())
                .createdAt(now)
                .updatedAt(now)
                .build();

        resourceRepository.save(resource);
        log.info("[RESOURCE] Created: id={}, type={}, title={}", resource.getId(), resource.getType(), resource.getTitle());
        return toDto(resource);
    }

    @Override
    public ResourceDTO updateResource(String resourceId, UpdateResourceRequest request) {
        Resource resource = findOrThrow(resourceId);

        if (request.type() != null) resource.setType(request.type());
        if (request.title() != null) resource.setTitle(request.title());
        if (request.description() != null) resource.setDescription(request.description());
        if (request.url() != null) resource.setUrl(request.url());
        if (request.thumbnailUrl() != null) resource.setThumbnailUrl(request.thumbnailUrl());
        resource.setUpdatedAt(Instant.now());

        resourceRepository.save(resource);
        log.info("[RESOURCE] Updated: id={}, type={}, title={}", resource.getId(), resource.getType(), resource.getTitle());
        return toDto(resource);
    }

    @Override
    public void deleteResource(String resourceId) {
        if (!resourceRepository.existsById(resourceId)) {
            throw new ResourceNotFoundException(resourceId);
        }
        resourceRepository.deleteById(resourceId);
        log.info("[RESOURCE] Deleted: id={}", resourceId);
    }

    @Override
    public List<ResourceDTO> searchResources(String query) {
        List<ResourceDTO> results = resourceRepository.findByKeyword(query).stream()
                .map(this::toDto)
                .toList();
        log.debug("[RESOURCE] Search query='{}': count={}", query, results.size());
        return results;
    }

    private Resource findOrThrow(String resourceId) {
        return resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException(resourceId));
    }

    private ResourceDTO toDto(Resource r) {
        return new ResourceDTO(
                r.getId(),
                r.getType(),
                r.getTitle(),
                r.getDescription(),
                r.getUrl(),
                r.getThumbnailUrl(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}