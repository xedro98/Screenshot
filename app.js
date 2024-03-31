const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

let browser;
let pagePool = [];

async function startBrowser() {
    browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
        ],
    });

    // Create a pool of pages
    for (let i = 0; i < 10; i++) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        pagePool.push(page);
    }
}

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    // Use a page from the pool
    const page = pagePool.pop();
    if (!page) {
        return res.status(503).send('Server too busy. Try again later.');
    }

    try {
        page.on('response', async (response) => {
            const status = response.status();
            if (status >= 400) {
                await page.setContent(`<h1>Error: ${status} ${response.statusText()}</h1>`);
            }
        });

        await page.goto(url, { waitUntil: 'load', timeout: 0 });
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
    } catch (error) {
        console.error(`Failed to navigate to ${url}`);
        await page.setContent(`<h1>Error: ${error.message}</h1>`); // Set custom error page content
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
    } finally {
        // Return the page to the pool
        pagePool.push(page);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Screenshot service running on port ${port}`);
    startBrowser();
});