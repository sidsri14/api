# Use the official Bun image (built on Debian)
FROM oven/bun:1

# Install OpenSSL and other necessary system libraries for Prisma/Node native modules
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install dependencies (frozen-lockfile is safer for production)
RUN bun install

# Copy the rest of the backend code
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Final setup: Railway provides the PORT environment variable
ENV PORT=3000
EXPOSE 3000

# Default start command (for the API service)
# Note: For the Worker service, override this to "bun src/worker.ts" in the Railway Dashboard
CMD ["bun", "src/index.ts"]
