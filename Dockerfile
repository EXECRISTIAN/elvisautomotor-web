# Elvis Automotores — imagen para correr el sitio y el panel (en una PC o en un servidor).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Variables mínimas para compilar (los valores reales se pasan al arrancar).
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=compilacion-solamente-no-se-usa-en-produccion-000 \
    S3_BUCKET_NAME=local S3_REGION=us-east-1 S3_ACCESS_KEY_ID=local S3_SECRET_ACCESS_KEY=local S3_ENDPOINT=http://localhost:9
RUN npx keystone build --no-ui && npx next build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
