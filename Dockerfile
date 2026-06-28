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

# Start the API server
CMD ["npm", "run", "start"]
