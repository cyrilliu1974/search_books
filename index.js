/**
 * 📍 修改於 index.js 的 /search_books 路由
 */
// 若無 convertToSC 函數，提供一個基本的 fallback 以避免 ReferenceError
const convertToSC = typeof global.convertToSC === 'function' ? global.convertToSC : (str) => str;
const PORT = process.env.PORT || 7860;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 服務已啟動，監聽埠號：${PORT}`);
});
app.get('/search_books', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: "請提供關鍵字" });

    const scKeyword = convertToSC(keyword);
    console.log(`🔍 啟動整合搜尋: ${scKeyword}`);

    try {
        const browser = await golem.getBrowser();

        // 定義搜尋任務清單
        const searchTasks = [
            { name: 'Z-Library', url: `https://zh.z-library.sk/s/${encodeURIComponent(scKeyword)}`, selector: '.resItemBox' },
            { name: 'WeLib', url: `https://zh.welib.org/search?q=${encodeURIComponent(scKeyword)}`, selector: '.search-result-item, .book-item' },
            { name: '搬書匠', url: `http://www.banshujiang.cn/e_books/search/page/1?searchWords=${encodeURIComponent(scKeyword)}`, selector: '.book-list-item, .list-group-item' },
            { name: '莫比圖書', url: `https://www.mobitushu.cn/search.php?q=${encodeURIComponent(scKeyword)}`, selector: '.search-list li' }
        ];

        // 併發執行所有搜尋
        const results = await Promise.allSettled(searchTasks.map(async (task) => {
            let page;
            try {
                page = await browser.newPage();
                // 設定模擬請求標頭
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                
                // 導航至搜尋頁面 (設定 15 秒逾時)
                await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 15000 });

                // 解析各站點結果
                const books = await page.evaluate((sel, sourceName) => {
                    const items = Array.from(document.querySelectorAll(sel));
                    return items.map(el => {
                        const linkEl = el.querySelector('a');
                        const titleEl = el.querySelector('h3, .title, a');
                        return {
                            title: titleEl ? titleEl.innerText.trim() : '未知書名',
                            url: linkEl ? linkEl.href : '#',
                            source: sourceName
                        };
                    }).slice(0, 5); // 每個來源取前 5 筆
                }, task.selector, task.name);

                return { source: task.name, books, count: books.length };
            } catch (err) {
                console.error(`❌ ${task.name} 抓取失敗:`, err.message);
                return { source: task.name, books: [], error: err.message };
            } finally {
                if (page) {
                    await page.close();
                }
            }
        }));

        // 彙整結果
        const finalData = results.map(r => r.status === 'fulfilled' ? r.value : { source: 'Unknown', books: [], error: 'Task failed' });
        
        res.json({
            status: "success",
            query: { original: keyword, converted: scKeyword },
            results: finalData
        });

    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});