# --- 階段 1：建置環境 (Build Stage) ---
FROM node:18-slim AS builder

WORKDIR /app

# 僅複製 package 檔案以利用快取
COPY package*.json ./

# 安裝生產環境所需的套件 (忽略開發套件以縮小體積)
RUN npm install --omit=dev

# --- 階段 2：執行環境 (Run Stage) ---
FROM node:18-slim

# 設定環境變數
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

WORKDIR /app

# 安裝執行 Chrome 最小限度的系統依賴庫 (與官方版相比大幅瘦身)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 從建置階段僅複製 node_modules
COPY --from=builder /app/node_modules ./node_modules
# 複製其餘原始碼
COPY . .

# 建立非 root 使用者以安全執行
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

EXPOSE 3000

CMD ["node", "index.js"]