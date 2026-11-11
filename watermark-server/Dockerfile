FROM node:22-bookworm

ENV NODE_ENV=production
ENV PORT=8080

# Install document conversion, PDF rasterization and fonts.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-writer \
      poppler-utils \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-core \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["npm", "start"]