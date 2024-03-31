const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

let browser;
let pagePool = [];
let queue = [];

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

async function processQueue() {
    if (queue.length > 0 && pagePool.length > 0) {
        const { req, res } = queue.shift();
        processRequest(req, res);
    }
}

async function processRequest(req, res) {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    // Use a page from the pool
    const page = pagePool.pop();

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 0 });
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
    } catch (error) {
        console.error(`Failed to navigate to ${url}`);
        const errorMessage = error.message.includes('net::ERR') ? 'Network error' : error.message;
        const errorPage = await browser.newPage();
        await errorPage.setContent(`<h1>Error: ${errorMessage}</h1>`); // Set custom error page content
        const screenshot = await errorPage.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
        await errorPage.close();
    } finally {
        // Return the page to the pool
        pagePool.push(page);
        processQueue();
    }
}

app.get('/screenshot', (req, res) => {
    if (pagePool.length > 0) {
        processRequest(req, res);
    } else {
        queue.push({ req, res });
    }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Screenshot service running on port ${port}`);
    startBrowser();
});