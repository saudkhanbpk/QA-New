FROM mcr.microsoft.com/playwright:v1.45.1-jammy

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
