FROM node:22

# Install poppler-utils
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Add debug command
RUN echo '{"name":"debug","scripts":{"start":"node src/pdf-debug.js"}}' > debug.json

# Expose the port your app runs on
EXPOSE 3000

# Run debug script first, then the main application
CMD ["sh", "-c", "node src/pdf-debug.js && npm start"]
