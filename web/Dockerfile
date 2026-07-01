FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
# db push creates/updates the tables on start, then the server boots
CMD ["sh", "-c", "npx prisma db push --skip-generate && node .output/server/index.mjs"]
