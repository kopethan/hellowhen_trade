FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN npm install
COPY . .
RUN npm run build -w @hellowhen/api
CMD ["npm", "run", "start", "-w", "@hellowhen/api"]
