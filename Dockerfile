# 使用內建 Chrome 的 Puppeteer 映像檔
FROM ghcr.io/puppeteer/puppeteer:21.5.2

USER root
WORKDIR /usr/src/app

# 複製設定檔並安裝依賴
COPY package*.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install

# 複製其餘程式碼並修正權限
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app
USER pptruser

EXPOSE 3000
CMD [ "node", "index.js" ]