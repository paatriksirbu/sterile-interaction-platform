package com.example.resourceservice.repository;

import com.example.resourceservice.model.Resource;
import com.example.shared.enums.ResourceType;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class ResourceRepository {

    private final Map<String, Resource> store = new ConcurrentHashMap<>();

    public List<Resource> findAll() {
        return new ArrayList<>(store.values());
    }

    public List<Resource> findByType(ResourceType type) {
        return store.values().stream()
                .filter(r -> r.getType() == type)
                .toList();
    }

    public Optional<Resource> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    public Resource save(Resource resource) {
        store.put(resource.getId(), resource);
        return resource;
    }

    public boolean existsById(String id) {
        return store.containsKey(id);
    }

    public void deleteById(String id) {
        store.remove(id);
    }
}