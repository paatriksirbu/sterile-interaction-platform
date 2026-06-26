# Sterile Interaction Platform

Plataforma de interacción sin contacto orientada a entornos clínicos simulados. El sistema permite consultar y manipular información digital mediante gestos de la mano y anotaciones por voz, reduciendo la necesidad de utilizar teclado, ratón o pantalla táctil.

El proyecto ha sido desarrollado como Trabajo de Fin de Grado en Ingeniería Informática.

## Descripción

La plataforma combina reconocimiento gestual, reconocimiento de voz y una arquitectura distribuida basada en microservicios.

La interacción gestual se realiza mediante MediaPipe Hands, que detecta 21 puntos de referencia de la mano a partir de una cámara convencional. A partir de estos puntos se reconocen gestos como:

* Pointing
* PINCH
* Open Hand
* Closed Fist

Estos gestos permiten navegar entre pantallas, seleccionar elementos, desplazarse por documentos, controlar contenido multimedia, manipular modelos tridimensionales y bloquear temporalmente la interacción.

El sistema también incorpora anotaciones mediante voz utilizando Web Speech API. Las transcripciones se asocian a una sesión y a un recurso concreto y se almacenan en PostgreSQL.

## Módulos principales

La interfaz está formada por cinco módulos:

* **Dashboard**: acceso a las distintas funcionalidades.
* **PDF Viewer**: visualización y desplazamiento por documentos.
* **Surgical Plan**: consulta y selección de pasos de un procedimiento.
* **Radiology**: visualización y manipulación de modelos anatómicos 3D.
* **Live Feed**: control de contenido multimedia local o en línea.

## Arquitectura

El backend está desarrollado mediante microservicios Spring Boot.

Principales componentes:

* API Gateway
* Gesture Service
* Orchestrator Service
* Session Service
* Annotation Service
* Notifier Service
* Resource Service
* Speech Service

La comunicación entre servicios se realiza mediante RabbitMQ. PostgreSQL se utiliza para persistir sesiones y anotaciones, mientras que WebSockets permiten enviar notificaciones al frontend en tiempo real.

## Tecnologías utilizadas

### Frontend

* HTML5
* CSS
* JavaScript
* MediaPipe Hands
* Web Speech API
* WebSockets

### Backend

* Java 21
* Spring Boot
* Spring Cloud Gateway
* Spring AMQP
* Spring Data JPA

### Infraestructura

* RabbitMQ
* PostgreSQL
* Docker
* Bash

## Requisitos

Para ejecutar el proyecto se necesita:

* Java 21
* Maven
* Docker
* Docker Compose
* Google Chrome o navegador compatible
* Cámara web
* Micrófono
* Bash

## Ejecución

Desde la raíz del proyecto:

```bash
chmod +x scripts/*.sh
./scripts/start-demo.sh
```

El script inicia:

* RabbitMQ
* PostgreSQL
* API Gateway
* Microservicios backend
* Servidor del frontend

Una vez iniciado el sistema, el Dashboard estará disponible en:

```text
http://localhost:3000/src/html/dashboard.html
```

## Comprobación del sistema

Para verificar que todos los componentes están activos:

```bash
./scripts/check-demo.sh
```

Para ejecutar también las pruebas de humo:

```bash
./scripts/check-demo.sh --smoke
```

Las pruebas comprueban:

* Infraestructura Docker
* API Gateway
* Microservicios
* Endpoints de salud
* Páginas del frontend
* Procesamiento de gestos
* Persistencia de sesiones
* Persistencia de anotaciones
* Procesamiento de transcripciones

## Parada del entorno

Para detener los servicios:

```bash
./scripts/stop-demo.sh
```

## Puertos principales

| Componente          | Puerto |
| ------------------- | -----: |
| Frontend            |   3000 |
| API Gateway         |   8080 |
| Gesture Service     |   8082 |
| Session Service     |   8084 |
| Notifier Service    |   8085 |
| Resource Service    |   8086 |
| Speech Service      |   8087 |
| Annotation Service  |   8088 |
| RabbitMQ AMQP       |   5672 |
| RabbitMQ Management |  15672 |
| PostgreSQL          |   5432 |

Orchestrator Service funciona como consumidor de RabbitMQ y no expone un puerto HTTP.

## Estructura general

```text
sterile-interaction-platform/
├── api-gateway/
├── gesture-service/
├── orchestrator-service/
├── session-service/
├── notifier-service/
├── resource-service/
├── speech-service/
├── annotation-service/
├── web-client/
├── scripts/
├── docker-compose.yml
└── README.md
```

## Alcance

Este proyecto es un prototipo técnico desarrollado y validado en un entorno local y simulado.

No ha sido validado en un entorno clínico real y no debe considerarse un producto sanitario ni un sistema preparado para uso asistencial.

## Autor

**Patrik Paul Sirbu**

Trabajo de Fin de Grado en Ingeniería Informática
Universidad Alfonso X el Sabio
2026
