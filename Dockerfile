FROM node:20

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY node_modules ./node_modules
RUN npm rebuild better-sqlite3

COPY dist ./dist

RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
