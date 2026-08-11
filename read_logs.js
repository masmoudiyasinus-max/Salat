import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  const logs = await page.evaluate(() => localStorage.getItem('prayer_tracker_diagnostic_logs'));
  console.log("LOGS:");
  console.log(logs);
  await browser.close();
})();
