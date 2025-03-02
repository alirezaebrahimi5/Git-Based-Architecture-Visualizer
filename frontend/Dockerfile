# frontend/Dockerfile
FROM node:22-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source files and build the app
COPY . .
RUN npm run build

# Expose the port (default Next.js port)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
