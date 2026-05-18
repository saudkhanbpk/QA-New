FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Install k6
RUN apt-get update && apt-get install -y gnupg ca-certificates wget \
    && gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5DB80EE323D6002 \
    && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | tee /etc/apt/sources.list.d/k6.list \
    && apt-get update && apt-get install -y k6

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
