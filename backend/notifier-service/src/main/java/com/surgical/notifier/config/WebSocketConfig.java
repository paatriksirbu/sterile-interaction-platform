package com.surgical.notifier.config;

// WebSocket support is ready to activate — spring-boot-starter-websocket is already on the classpath.
//
// To enable:
//   1. Uncomment @Configuration and @EnableWebSocketMessageBroker
//   2. Inject SimpMessagingTemplate into NotificationServiceImpl
//   3. Call messagingTemplate.convertAndSend("/topic/notifications", msg) from pushToFrontend()
//
// @Configuration
// @EnableWebSocketMessageBroker
public class WebSocketConfig /* implements WebSocketMessageBrokerConfigurer */ {

//    @Override
//    public void configureMessageBroker(MessageBrokerRegistry registry) {
//        registry.enableSimpleBroker("/topic");
//        registry.setApplicationDestinationPrefixes("/app");
//    }
//
//    @Override
//    public void registerStompEndpoints(StompEndpointRegistry registry) {
//        registry.addEndpoint("/ws-notifications")
//                .setAllowedOriginPatterns("*")
//                .withSockJS();
//    }
}
