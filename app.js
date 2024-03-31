const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const request = require('request-promise');

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

// Set a reasonable timeout for page navigation
const PAGE_NAVIGATION_TIMEOUT_MS = 600000; // 30 seconds

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
        // Make a request to the URL before navigating to it
        await request(url);

        if (consoleErrors.length > 0) {
            const errorHtml = `<div style="position: absolute; top: 0; left: 0; background: rgba(255, 0, 0, 0.7); color: white; padding: 10px;">${consoleErrors.join('<br/>')}</div>`;
            await page.evaluate((errorHtml) => {
                const div = document.createElement('div');
                div.innerHTML = errorHtml;
                document.body.appendChild(div);
            }, errorHtml);
        } else if (requestFailure) {
            const errorHtml = `<div style="position: absolute; top: 0; left: 0; background: rgba(255, 0, 0, 0.7); color: white; padding: 10px;">Request Failed: ${requestFailure.errorText}</div>`;
            await page.evaluate((errorHtml) => {
                const div = document.createElement('div');
                div.innerHTML = errorHtml;
                document.body.appendChild(div);
            }, errorHtml);
        }

        const screenshot = await page.screenshot({ encoding: 'base64' }); // Capture the viewport
        res.send(screenshot);
    } catch (error) {
        console.error(`Failed to navigate to ${url}`);
        let errorMessage = error.message.includes('net::ERR') ? 'Network error' : error.message;
        // Include the error stack trace if it's a network error
        if (errorMessage === 'Network error') {
            errorMessage += `<br/><br/>Debug Info:<br/>${error.stack.replace(/\n/g, '<br/>')}`;
        }
        // Include the error message from the failed request
        errorMessage += `<br/><br/>Request Error:<br/>${error.message.replace(/\n/g, '<br/>')}`;
        const errorPage = await browser.newPage();
        await errorPage.setContent(`<h1>Error: ${errorMessage}</h1>`); // Set custom error page content
        const screenshot = await errorPage.screenshot({ encoding: 'base64' });
        res.send(screenshot);
        await errorPage.close();
    } finally {
        // Check if the page is still open before returning it to the pool
        if (!page.isClosed()) {
            pagePool.push(page);
        }
        // Process the next request in the queue asynchronously to allow for concurrency
        setImmediate(processQueue);
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