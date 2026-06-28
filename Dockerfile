FROM node:20-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies (including tsx for running the server)
RUN npm install

# Copy application source code
COPY . .

# Expose Fastify's API port
EXPOSE 3001

# Run migrations and then start the API server
CMD ["sh", "-c", "npm run migrate && npm run start"]
