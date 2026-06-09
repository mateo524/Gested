# ---- Build stage ----
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev --no-audit --legacy-peer-deps

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S zentor && adduser -S zentor -G zentor

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Cloud Run injects PORT (default 8080); expose it for documentation
EXPOSE 8080

# Switch to non-root user
USER zentor

# Start the server
CMD ["node", "server.js"]
