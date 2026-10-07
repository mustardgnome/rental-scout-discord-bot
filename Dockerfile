FROM node:20

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
