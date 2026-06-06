FROM nginx:1.27-alpine

ENV WEB_PORT=80
ENV WEB_HTTPS_PORT=443
ENV VITE_API_PROXY=http://api:8080
ENV VITE_WEB_PROXY=http://web-source:5173

RUN apk add --no-cache openssl \
  && mkdir -p /etc/nginx/ssl \
  && openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/localtrip.key \
    -out /etc/nginx/ssl/localtrip.crt \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80 443
