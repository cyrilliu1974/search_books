FROM ghcr.io/puppeteer/puppeteer:21.5.2
USER root
WORKDIR /usr/src/app
COPY package*.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
RUN npm install
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app
USER pptruser
EXPOSE 7860
CMD [ "node", "index.js" ]