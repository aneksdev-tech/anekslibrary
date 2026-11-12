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
    printf '%s\n' \
      '<?xml version="1.0"?>' \
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' \
      '<fontconfig>' \
      '  <alias binding="strong">' \
      '    <family>Times New Roman</family>' \
      '    <prefer><family>Liberation Serif</family></prefer>' \
      '  </alias>' \
      '  <alias binding="strong">' \
      '    <family>Times-Roman</family>' \
      '    <prefer><family>Liberation Serif</family></prefer>' \
      '  </alias>' \
      '</fontconfig>' \
      > /etc/fonts/conf.d/99-aneks-font-aliases.conf && \
    fc-cache -f && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["npm", "start"]