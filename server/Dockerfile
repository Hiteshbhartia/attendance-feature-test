FROM node:20-alpine

WORKDIR /app

# Install deps first for better cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
