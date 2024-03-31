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
    let consoleErrors = [];
    let requestFailure = null;

    page.on('console', async msg => {
        if (msg.type() === 'error') {
            const location = msg.location();
            consoleErrors.push(`Error: ${msg.text()} at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
        }
    });

    page.on('requestfailed', request => {
        requestFailure = request.failure();
    });

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 0 });
        if (consoleErrors.length > 0) {
            await page.setContent(`<h1>${consoleErrors.join('<br/>')}</h1>`);
        } else if (requestFailure) {
            await page.setContent(`<h1>Request Failed: ${requestFailure.errorText}</h1>`);
        }
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
    } catch (error) {
        console.error(`Failed to navigate to ${url}`);
        const errorMessage = error.message.includes('net::ERR') ? 'Network error' : error.message;
        await page.setContent(`<h1>Error: ${errorMessage}</h1>`); // Set custom error page content
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
        res.send(screenshot);
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