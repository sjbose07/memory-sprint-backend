# Use the official Node.js 20 image (or an alpine version for a smaller image)
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Hugging Face Spaces routes traffic to port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Ensure the app binds to 0.0.0.0
ENV HOST=0.0.0.0

# Start the application
CMD ["npm", "start"]
