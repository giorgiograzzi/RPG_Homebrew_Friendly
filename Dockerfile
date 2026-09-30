# syntax=docker/dockerfile:1
# Fase 1: build dell'app (Vite + PWA). I dati di gioco stanno in data/private (non tracciati in git): devono essere
# presenti nella cartella da cui lanci "docker compose build", perché finiscono dentro il bundle.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN [ -d data/private ] || echo "ATTENZIONE: data/private non c'è, l'app partirà senza dati di gioco (vedi README, sezione Docker)"
RUN npm run build

# Fase 2: solo file statici serviti da nginx
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/headers.conf /etc/nginx/headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
