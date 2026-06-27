FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN bun install

COPY . .

# Build client-side bundle
RUN bun run build:client

EXPOSE 3000

CMD ["bun", "src/local.tsx"]
