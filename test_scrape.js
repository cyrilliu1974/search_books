const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    async function testSite(name, url, selector) {
        console.log(`\nTesting ${name}...`);
        const page = await browser.newPage();
        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            console.log(`HTTP Status:`, response ? response.status() : 'N/A');
            
            const html = await page.content();
            console.log(`HTML Length:`, html.length);
            
            const items = await page.$$(selector);
            console.log(`Items found with selector '${selector}':`, items.length);

            if (items.length === 0) {
                console.log("No items found. Here is a snippet of the body:");
                const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
                console.log(bodyText.replace(/\n/g, ' '));
            }
        } catch (e) {
            console.error(`Error testing ${name}:`, e.message);
        } finally {
            await page.close();
        }
    }

    const keyword = "%E4%BA%BA%E7%B1%BB"; // 人类

    await testSite('WeLib', `https://zh.welib.org/search?q=${keyword}`, '.search-result-item');
    await testSite('搬書匠', `http://www.banshujiang.cn/e_books/search/page/1?searchWords=${keyword}`, '.book-list-item');
    await testSite('莫比圖書', `https://www.mobitushu.cn/search.php?q=${keyword}`, '.search-list li');

    await browser.close();
})();
