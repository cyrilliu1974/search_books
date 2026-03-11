# 使用官方 Node.js 20 作為基底
FROM node:20-slim

USER root
WORKDIR /usr/src/app

# 安裝 Puppeteer 必要的依賴、Python 以及 FlareSolverr 需要的 Firefox (Xvfb)
# 更新並安裝各種圖形庫與瀏覽器引擎
RUN apt-get update && apt-get install -y \
    wget gnupg git python3 python3-pip xvfb \
    libnss3 libxss1 libgconf-2-4 libasound2 libatk-bridge2.0-0 libgtk-3-0 \
    firefox-esr \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*
    
# 安裝 Google Chrome (為了 Puppeteer)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 複製 Node.js 專案文件並安裝專案依賴
COPY package*.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
RUN npm install

# 下載並安裝 FlareSolverr
RUN git clone https://github.com/FlareSolverr/FlareSolverr.git /usr/src/app/flaresolverr \
    && cd /usr/src/app/flaresolverr \
    && pip3 install -r requirements.txt --break-system-packages

# 複製其餘的專案檔案
COPY . .

# 直接在 Docker 中建立啟動腳本，避免跨平台換行符號與找不到檔案的問題
RUN echo '#!/bin/bash\n\
echo "Starting FlareSolverr..."\n\
python3 /usr/src/app/flaresolverr/flaresolverr.py &\n\
sleep 5\n\
echo "FlareSolverr started."\n\
echo "Starting Node.js server..."\n\
node index.js\n\
' > start.sh && chmod +x start.sh

# Hugging Face 建議對所有人開放權限方便執行
RUN chmod -R 777 /usr/src/app

# Hugging Face Space 需要監聽的 Port
EXPOSE 7860

# 強制用 root 來執行（避免權限與 Xvfb 問題）
CMD [ "./start.sh" ]
