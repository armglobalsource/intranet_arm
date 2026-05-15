FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx nest build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main"]
