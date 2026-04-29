package com.example.orchestratorservice.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE           = "surgical.events";
    public static final String GESTURE_QUEUE      = "orchestrator.gesture.queue";
    public static final String GESTURE_ROUTING_KEY = "gesture.detected";
    public static final String COMMAND_ROUTING_KEY = "command.interaction";

    @Bean
    public TopicExchange surgicalExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue gestureQueue() {
        return QueueBuilder.durable(GESTURE_QUEUE).build();
    }

    @Bean
    public Binding gestureBinding(Queue gestureQueue, TopicExchange surgicalExchange) {
        return BindingBuilder.bind(gestureQueue).to(surgicalExchange).with(GESTURE_ROUTING_KEY);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        return factory;
    }
}
