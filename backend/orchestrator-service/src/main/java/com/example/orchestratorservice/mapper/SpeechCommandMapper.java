package com.example.orchestratorservice.mapper;

import com.example.shared.enums.InteractionCommandType;
import java.text.Normalizer;
import java.util.Optional;

public class SpeechCommandMapper {

    private SpeechCommandMapper() {}

    public static Optional<InteractionCommandType> toCommandType(String rawText) {
        if (rawText == null) return Optional.empty();
        String normalized = Normalizer.normalize(rawText.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return switch (normalized) {
            case "siguiente pagina", "siguiente" -> Optional.of(InteractionCommandType.NEXT);
            case "pagina anterior", "anterior"   -> Optional.of(InteractionCommandType.PREVIOUS);
            case "seleccionar"                   -> Optional.of(InteractionCommandType.SELECT);
            case "bloquear", "desbloquear"       -> Optional.of(InteractionCommandType.LOCK);
            case "pausar", "pausa"               -> Optional.of(InteractionCommandType.PAUSE);
            default                              -> Optional.empty();
        };
    }
}
