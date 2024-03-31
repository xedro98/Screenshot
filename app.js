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
        await page.goto(url, { waitUntil: 'load', timeout: 0 });
    } catch (error) {
        console.error(`Failed to navigate to ${url}`);
    }

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });

    // Return the page to the pool
    pagePool.push(page);

    res.send(screenshot);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Screenshot service running on port ${port}`);
    startBrowser();
});