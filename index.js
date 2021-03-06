const express = require('express');
const app = express();
const { exec } = require('child_process');
const puppeteer = require('puppeteer');

app.use((req, res, next) => {
  const allowedHeaders = [
    'X-Requested-With',
    'Accept',
    'Origin',
    'Referer',
    'User-Agent',
    'Content-Type',
    'Authorization',
    'X-Mindflash-SessionID'
  ];

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));

  if (req.method !== 'OPTIONS') {
    return next();
  }

  return res.sendStatus(200);
});

(async () => {
  app.get('/leita/:kennitala', async (req, res, next) => {
    try {
      const { kennitala } = req.params;

      const data = await getData(kennitala);

      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let requestId = 1;

  const getData = async kennitala => {
    const localId = ++requestId;

    console.log(`${localId}: starting`);

    let page = await browser.newPage();

    console.log(`${localId}: goto page`);
    await page.goto('https://kjorskra.skra.is/kjorskra/', {
      waitUntil: 'networkidle'
    });
    await page.focus('#txtKennitala_I');
    await page.type('#txtKennitala_I', (kennitala || '').toString(), {
      delay: 0
    });
    await page.click('#btnLeit_CD');

    try {
      await page.waitFor('#ASPxGridView1_DXDataRow0', { timeout: 2000 });
    } catch (e) {
      return {
        success: false,
        message: 'Kennitala not found'
      };
      page.close();
    }

    const cells = await page.$$('#ASPxGridView1_DXDataRow0 td');

    const data = await Promise.all(
      [...cells].map(async rowElement => {
        const items = await page.evaluate(async el => {
          const tds = el.querySelectorAll('td');
          console.log('el', el.textContent.trim());
          return el.textContent.trim();
        }, rowElement);

        return items;
      })
    );

    page.close();

    console.log(`${localId}: done`);

    return {
      success: true,
      kennitala: data[0],
      nafn: data[1],
      logheimili: data[2],
      kjordaemi: data[3],
      sveitafelag: data[4],
      kjorstadur: data[5],
      kjordeild: data[6]
    };
  };

  const PORT = process.env.PORT || 3400;

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
})();
