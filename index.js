/**
 * 🦞 Project Golem - Ebook Search Edition
 */
require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const OpenCC = require('opencc-js');

const app = express();
// ⚠️ 重要：Hugging Face 必須監聽 7860
const PORT = process.env.PORT || 7860; 

puppeteer.use(StealthPlugin());

// 繁簡轉換器
const convertToSC = OpenCC.Converter({ from: 'hk', to: 'cn' });

// 延用你上傳的 BrowserManager 架構
class BrowserManager {
    constructor() { this.browser = null; this.isLaunching = false; }
    async getBrowser() {
        if (this.browser && this.browser.isConnected()) return this.browser;
        if (this.isLaunching) { await new Promise(r => setTimeout(r, 500)); return this.getBrowser(); }
        this.isLaunching = true;
        try {
            this.browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            });
            return this.browser;
        } finally { this.isLaunching = false; }
    }
}
const golem = new BrowserManager();

// 呼叫 FlareSolverr API 的備用函式
async function fetchWithFlareSolverr(url) {
    try {
        const response = await fetch('http://localhost:8191/v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cmd: 'request.get',
                url: url,
                maxTimeout: 15000
            })
        });
        const data = await response.json();
        if (data.status === 'ok' && data.solution) {
            return data.solution.response;
        }
        throw new Error(data.message || 'Unknown error');
    } catch (e) {
        throw new Error(e.message);
    }
}

app.use(express.static('public'));

app.get('/search_books', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: "請輸入書名" });

    const scKeyword = convertToSC(keyword);
    try {
        const browser = await golem.getBrowser();
        const searchTasks = [
            { name: 'Z-Library', url: `https://zh.z-library.sk/s/${encodeURIComponent(scKeyword)}`, selector: '.resItemBox' },
            { name: 'WeLib', url: `https://zh.welib.org/search?q=${encodeURIComponent(scKeyword)}`, selector: '.search-result-item' },
            { name: '搬書匠', url: `http://www.banshujiang.cn/e_books/search/page/1?searchWords=${encodeURIComponent(scKeyword)}`, selector: '.book-list-item' },
            { name: '莫比圖書', url: `https://www.mobitushu.cn/search.php?q=${encodeURIComponent(scKeyword)}`, selector: 'article.post' }
        ];

        const results = await Promise.allSettled(searchTasks.map(async (task) => {
            const page = await browser.newPage();
            try {
                // 等待 domcontentloaded 比 networkidle2 快，並加上捕獲 HTTP 狀態
                const response = await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const statusCode = response ? response.status() : 'N/A';
                
                const evalResult = await page.evaluate((sel, source, scKeyword) => {
                    const els = Array.from(document.querySelectorAll(sel));
                    if (els.length === 0) {
                        return { books: [], htmlSnippet: document.body ? document.body.innerText.substring(0, 500) : "No body found" };
                    }
                    
                    // 莫比圖書在找不到結果時會硬塞熱門書單，這裡做個簡單過濾
                    const rawBooks = els.map(el => ({
                        title: el.innerText.trim().split('\n')[0],
                        url: el.querySelector('a')?.href || '#',
                        source
                    }));
                    
                    // 若標題內皆無關鍵字，就視為該平台查無此書 (過濾掉硬塞的熱門書)
                    const books = source === '莫比圖書' 
                        ? rawBooks.filter(b => b.title.toLowerCase().includes(scKeyword.toLowerCase()))
                        : rawBooks.slice(0, 5);

                    return { 
                        books: books.slice(0, 5),
                        htmlSnippet: null
                    };
                }, task.selector, task.name, scKeyword);
                
                let books = evalResult.books;
                let debugMsg = `請求成功 (HTTP ${statusCode})，擷取到 ${books.length} 筆`;
                
                if (books.length === 0) {
                    debugMsg += `\n[HTML excerpt]: ${evalResult.htmlSnippet.replace(/\n/g, ' ')}`;
                    try {
                        console.log(`⚠️ ${task.name} 找不到資料，啟動 FlareSolverr 備援...`);
                        const flareHtml = await fetchWithFlareSolverr(task.url);
                        if (flareHtml) {
                            await page.setContent(flareHtml, { waitUntil: 'domcontentloaded' });
                            evalResult = await page.evaluate((sel, source, scKeyword) => {
                                const els = Array.from(document.querySelectorAll(sel));
                                if (els.length === 0) return { books: [], htmlSnippet: document.body ? document.body.innerText.substring(0, 500) : "No body found" };
                                const rawBooks = els.map(el => ({
                                    title: el.innerText.trim().split('\n')[0],
                                    url: el.querySelector('a')?.href || '#',
                                    source
                                }));
                                const bks = source === '莫比圖書' ? rawBooks.filter(b => b.title.toLowerCase().includes(scKeyword.toLowerCase())) : rawBooks.slice(0, 5);
                                return { books: bks.slice(0, 5), htmlSnippet: null };
                            }, task.selector, task.name, scKeyword);
                            
                            books = evalResult.books;
                            debugMsg += `\n[FlareSolverr 備援] 擷取到 ${books.length} 筆`;
                            if (books.length === 0) debugMsg += `\n[Flare excerpt]: ${evalResult.htmlSnippet.replace(/\n/g, ' ')}`;
                        }
                    } catch (flareErr) {
                        debugMsg += `\n[FlareSolverr 備援失敗]: ${flareErr.message}`;
                    }
                }

                return { source: task.name, books, debug: debugMsg };
            } catch (err) { 
                return { source: task.name, books: [], debug: `連線/解析失敗: ${err.message}` };
            } finally { await page.close(); }
        }));

        res.json({ status: "success", results: results.map(r => r.status === 'fulfilled' ? r.value : { source: 'Unknown task', books: [], debug: `Promise rejected: ${r.reason}` }) });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`📡 服務已啟動: http://localhost:${PORT}`));