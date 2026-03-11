#!/bin/bash

# 啟動 FlareSolverr 在背景執行 (預設 port 8191)
echo "Starting FlareSolverr..."
python3 /usr/src/app/flaresolverr/flaresolverr.py &

# 等待幾秒鐘確保 FlareSolverr 啟動完畢
sleep 5
echo "FlareSolverr started."

# 啟動主要的 Node.js 程式
echo "Starting Node.js server..."
node index.js
