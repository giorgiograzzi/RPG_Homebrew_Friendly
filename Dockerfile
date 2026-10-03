# syntax=docker/dockerfile:1
# Fase 1: build dell'app (Vite + PWA). I dati di gioco (SRD 5.2.1, IT+EN) stanno in data/srd, tracciati in git: finiscono dentro il bundle.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG GIT_COMMIT=
ENV GIT_COMMIT=$GIT_COMMIT
RUN [ -f data/srd/it/classes.json ] && [ -f data/srd/en/classes.json ] || (echo "ERRORE: mancano i dati di gioco in data/srd" && exit 1)
RUN npm run build

# Fase 2: solo file statici serviti da nginx
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/headers.conf /etc/nginx/headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY sito /usr/share/nginx/html/sito
# I file di sito/ arrivano con i permessi del server (umask restrittiva): nginx deve poterli leggere
RUN chmod -R a+rX /usr/share/nginx/html/sito
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
