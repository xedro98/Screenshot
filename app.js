const express = require('express');
const puppeteer = require('puppeteer');
const usePool = require('puppeteer-pool'); // A Puppeteer pool library

const app = express();

// Create a pool of browser instances
const browserPool = usePool({
    max: 10, // Maximum 10 browsers
    min: 2,  // Keep at least 2 browsers open
    validator: () => Promise.resolve(true),
    puppeteerArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
    ],
});

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    // Acquire a browser instance from the pool
    const browser = await browserPool.acquire();

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const screenshot = await page.screenshot({ encoding: 'base64' });

    await page.close();

    // Release the browser instance back to the pool
    await browserPool.release(browser);

    res.send(screenshot);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Screenshot service running on port ${port}`);
});