# Stage 1: Build frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ENV REACT_APP_API_URL=/api
RUN npm run build

# Stage 2: Production backend + frontend build
FROM node:20-slim
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --production

# Copy backend source
COPY backend/ .

# Copy frontend build from stage 1
COPY --from=frontend /app/frontend/build ./frontend-build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
