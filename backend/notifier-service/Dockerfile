FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /build

# 1. Register parent POMs in local repo (non-recursive, no source needed)
COPY pom.xml .
RUN mvn install -N -q

COPY backend/pom.xml backend/pom.xml
RUN mvn install -N -f backend/pom.xml -q

# 2. Build and install shared module
COPY shared/surgical-shared-events/pom.xml shared/surgical-shared-events/pom.xml
COPY shared/surgical-shared-events/src     shared/surgical-shared-events/src
RUN mvn install -f shared/surgical-shared-events/pom.xml -DskipTests -q

# 3. Build notifier-service
COPY backend/notifier-service/pom.xml backend/notifier-service/pom.xml
COPY backend/notifier-service/src     backend/notifier-service/src
RUN mvn package -f backend/notifier-service/pom.xml -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/backend/notifier-service/target/*.jar app.jar
EXPOSE 8085
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
