package com.example.resourceservice.controller;

import com.example.resourceservice.dto.CreateResourceRequest;
import com.example.resourceservice.dto.ResourceDTO;
import com.example.resourceservice.dto.UpdateResourceRequest;
import com.example.resourceservice.service.ResourceService;
import com.example.shared.enums.ResourceType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceService resourceService;

    @GetMapping
    public ResponseEntity<List<ResourceDTO>> getAllResources() {
        return ResponseEntity.ok(resourceService.getAllResources());
    }

    @GetMapping("/{resourceId}")
    public ResponseEntity<ResourceDTO> getResourceById(@PathVariable String resourceId) {
        return ResponseEntity.ok(resourceService.getResourceById(resourceId));
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<ResourceDTO>> getResourcesByType(@PathVariable ResourceType type) {
        return ResponseEntity.ok(resourceService.getResourcesByType(type));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceDTO createResource(@RequestBody @Valid CreateResourceRequest request) {
        return resourceService.createResource(request);
    }

    @PatchMapping("/{resourceId}")
    public ResponseEntity<ResourceDTO> updateResource(
            @PathVariable String resourceId,
            @RequestBody UpdateResourceRequest request) {
        return ResponseEntity.ok(resourceService.updateResource(resourceId, request));
    }

    @DeleteMapping("/{resourceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResource(@PathVariable String resourceId) {
        resourceService.deleteResource(resourceId);
    }
}