# Usa la imagen oficial de Node.js ligera
FROM node:20-alpine

# Define el directorio de trabajo
WORKDIR /app

# Copia los archivos de configuración
COPY package*.json ./

# Instala todas las dependencias
RUN npm ci

# Copia el código fuente completo
COPY . .

# Compila el frontend (Vite genera la carpeta /app/dist)
RUN npm run build

# Instala una utilidad ligera para servir archivos estáticos en producción
RUN npm install -g serve

# Expone el puerto del frontend (3000) y del backend WebSocket (8080)
EXPOSE 3000
EXPOSE 8080

# Inicia ambos servicios simultáneamente usando concurrently
CMD ["npx", "concurrently", "\"serve -s dist -l 3000\"", "\"node server/websocket-server.js\""]
