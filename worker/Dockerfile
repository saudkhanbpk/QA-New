FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Install k6 (Direct static binary download to avoid GPG/keyserver connection errors)
RUN apt-get update && apt-get install -y wget ca-certificates \
    && wget -q https://github.com/grafana/k6/releases/download/v0.51.0/k6-v0.51.0-linux-amd64.tar.gz \
    && tar -xzf k6-v0.51.0-linux-amd64.tar.gz \
    && mv k6-v0.51.0-linux-amd64/k6 /usr/bin/k6 \
    && rm -rf k6-v0.51.0-linux-amd64.tar.gz k6-v0.51.0-linux-amd64 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm run build

# Run the worker script
CMD ["npm", "start"]
