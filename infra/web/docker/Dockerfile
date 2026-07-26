FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_LIFEHUB_BRIDGE_ADDRESS
ARG VITE_LIFEHUB_BRIDGE_PORT
ENV VITE_LIFEHUB_BRIDGE_ADDRESS=${VITE_LIFEHUB_BRIDGE_ADDRESS}
ENV VITE_LIFEHUB_BRIDGE_PORT=${VITE_LIFEHUB_BRIDGE_PORT}

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine

ENV WEB_PORT=80
ENV WEB_HTTPS_PORT=443
ENV VITE_API_PROXY=http://api:8080

RUN apk add --no-cache openssl \
  && mkdir -p /etc/nginx/ssl \
  && openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/localtrip.key \
    -out /etc/nginx/ssl/localtrip.crt \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80 443
