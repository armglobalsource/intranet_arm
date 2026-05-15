FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx nest build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main"]
