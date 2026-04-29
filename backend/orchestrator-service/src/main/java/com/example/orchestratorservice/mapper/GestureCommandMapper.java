package com.example.orchestratorservice.mapper;

import com.example.shared.enums.GestureType;
import com.example.shared.enums.InteractionCommandType;

public final class GestureCommandMapper {

    private GestureCommandMapper() {}

    public static InteractionCommandType toCommandType(GestureType gestureType) {
        return switch (gestureType) {
            case PINCH, APPROVAL      -> InteractionCommandType.SELECT;
            case POINTING, SPHERICAL  -> InteractionCommandType.NAVIGATE;
            case LOCK_GESTURE         -> InteractionCommandType.LOCK;
            case CLOSED_FIST,
                 OPEN_HAND,
                 UNKNOWN              -> InteractionCommandType.NO_OP;
        };
    }
}
