package com.surgical.notifier.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE              = "surgical.events";
    public static final String COMMAND_QUEUE         = "notifier.interaction.command.queue";
    public static final String COMMAND_ROUTING_KEY   = "command.interaction";
    public static final String ANNOTATION_QUEUE      = "notifier.annotation.queue";
    public static final String ANNOTATION_ROUTING_KEY = "annotation.created";

    @Bean
    public TopicExchange surgicalExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue commandQueue() {
        return QueueBuilder.durable(COMMAND_QUEUE).build();
    }

    @Bean
    public Binding commandBinding(@Qualifier("commandQueue") Queue commandQueue, TopicExchange surgicalExchange) {
        return BindingBuilder.bind(commandQueue).to(surgicalExchange).with(COMMAND_ROUTING_KEY);
    }

    @Bean
    public Queue annotationQueue() {
        return QueueBuilder.durable(ANNOTATION_QUEUE).build();
    }

    @Bean
    public Binding annotationBinding(@Qualifier("annotationQueue") Queue annotationQueue, TopicExchange surgicalExchange) {
        return BindingBuilder.bind(annotationQueue).to(surgicalExchange).with(ANNOTATION_ROUTING_KEY);
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
