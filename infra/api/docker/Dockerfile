FROM gradle:8.8-jdk17 AS build
WORKDIR /app
COPY apps/api /app
RUN if [ -x ./gradlew ]; then ./gradlew bootJar --no-daemon; else gradle bootJar --no-daemon; fi

FROM node:20-alpine AS codex-cli
RUN npm install -g @openai/codex \
    && mkdir -p /out \
    && cp "$(find /usr/local/lib/node_modules/@openai/codex -path '*/vendor/*/codex/codex' -type f | head -n 1)" /out/codex \
    && chmod +x /out/codex

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && python3 -m pip install --no-cache-dir --break-system-packages \
        requests \
        beautifulsoup4 \
        lxml \
        pandas \
        openpyxl \
        httpx \
    && rm -rf /var/lib/apt/lists/*
COPY --from=codex-cli /out/codex /opt/jupiter-cli/bin/codex
COPY --from=build /app/build/libs/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
