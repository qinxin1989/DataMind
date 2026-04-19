const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const apiErrors = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/admin/menus/user')) {
      const text = await response.text().catch(() => '<read-failed>');
      console.log(JSON.stringify({ url, status: response.status(), headers: await response.allHeaders(), text }, null, 2));
    }
  });
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder="用户名"]', 'admin');
  await page.fill('input[placeholder="密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/admin/menus/user', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text, token: token?.slice(0, 20) };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
