# Stage 1: Build & Prepare
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configuration files
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies needed for build and tsx runtime)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the frontend assets (generates the 'dist' directory)
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3004

# Copy necessary package configurations
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Copy node_modules (since tsx is used to run the server.ts TypeScript file directly)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled static assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Expose the internal port of the Express server
EXPOSE 3004

# Command to execute the production server using tsx
CMD ["npx", "tsx", "server.ts"]
