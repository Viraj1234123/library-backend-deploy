FROM node:22

# Install poppler-utils
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Patch pdf-poppler to bypass platform check
RUN if [ -f "node_modules/pdf-poppler/index.js" ]; then \
      sed -i 's/linux is NOT supported/\/\/ Bypassed platform check/g' node_modules/pdf-poppler/index.js; \
    fi

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
