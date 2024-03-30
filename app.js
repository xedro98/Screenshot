const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

app.get('/screenshot', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url);
    const screenshot = await page.screenshot({ encoding: 'base64' });

    await browser.close();

    res.send(screenshot);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Screenshot service running on port ${port}`));