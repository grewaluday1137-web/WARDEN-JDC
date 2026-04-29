FROM node:20-slim

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install all dependencies (including dev deps like ts-node)
RUN npm ci

# Copy full source
COPY . .

# Default to 8080 for Cloud Run
ENV PORT=8080

# Start using ts-node directly
CMD ["npm", "run", "start:cloud", "-w", "api"]
