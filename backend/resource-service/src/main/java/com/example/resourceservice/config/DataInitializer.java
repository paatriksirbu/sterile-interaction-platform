package com.example.resourceservice.config;

import com.example.resourceservice.model.Resource;
import com.example.resourceservice.repository.ResourceRepository;
import com.example.shared.enums.ResourceType;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer {

		private final ResourceRepository resourceRepository;

    @PostConstruct
    public void init() {
        Instant now = Instant.now();

        resourceRepository.save(Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(ResourceType.PDF)
                .title("Moore: Anatomía con orientación clínica")
                .description("Manual de referencia anatómica para cirujanos. Séptima edición.")
                .url("/assets/Moore_Anatomia_con_orientacion_clinica_7.pdf")
                .thumbnailUrl("/assets/thumbnails/moore-anatomy.png")
                .createdAt(now)
                .updatedAt(now)
                .build());

        resourceRepository.save(Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(ResourceType.PDF)
                .title("Protocolo de vendaje de tobillo")
                .description("Informe clínico con protocolo estándar de inmovilización y vendaje funcional.")
                .url("/assets/protocolo_vendaje_tobillo.pdf")
                .thumbnailUrl("/assets/thumbnails/protocolo-vendaje.png")
                .createdAt(now)
                .updatedAt(now)
                .build());

        resourceRepository.save(Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(ResourceType.VIDEO)
                .title("Tutorial: Vendaje funcional de tobillo")
                .description("Vídeo formativo paso a paso sobre la técnica de vendaje funcional.")
                .url("/assets/videos/Video_vendaje_tobillo.mp4")
                .thumbnailUrl("/assets/thumbnails/video-vendaje.png")
                .createdAt(now)
                .updatedAt(now)
                .build());

        resourceRepository.save(Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(ResourceType.MODEL_3D)
                .title("Modelo 3D: Rodilla")
                .description("Modelo anatómico 3D de la articulación de la rodilla para visualización quirúrgica.")
                .url("/assets/knee/model.fbx")
                .thumbnailUrl("/assets/thumbnails/knee-model.png")
                .createdAt(now)
                .updatedAt(now)
                .build());

        resourceRepository.save(Resource.builder()
                .id(UUID.randomUUID().toString())
                .type(ResourceType.MODEL_3D)
                .title("Modelo 3D: Cerebro")
                .description("Modelo OBJ del cerebro humano para prácticas de neurociencia y neurocirugía.")
                .url("/assets/Brain_Model.obj")
                .thumbnailUrl("/assets/thumbnails/brain-model.png")
                .createdAt(now)
                .updatedAt(now)
                .build());

        log.info("[RESOURCE] Data initialized: {} resources loaded", resourceRepository.findAll().size());
    }
}