const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

let browser;

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
}

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });

    await page.close();

    res.send(screenshot);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Screenshot service running on port ${port}`);
    startBrowser();
});