// Native browser input against local synthetic data; never route requests to production.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const webRequire = createRequire(path.join(__dirname, '../web/package.json'));
const { chromium } = webRequire('playwright-core');
const { server } = require('./preview.cjs');
const isAccount = require('../web/package.json').name === 'cpa-account-ops-ui';
const pluginPath = isAccount ? '/' : '/ui';
const readySelector = isAccount ? '[data-testid="account-ops-page"]' : '.evaluation-page';
const frameMetrics = frame => frame.evaluate(() => ({ y: scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight, overflow: getComputedStyle(document.body).overflowY }));
async function nextPaint(page) { await page.evaluate(() => new Promise(requestAnimationFrame)); }
async function waitForScroll(frame, start) {
  await frame.waitForFunction(y => scrollY > y + 5, start, { timeout: 3000 });
  return (await frameMetrics(frame)).y;
}
async function settled(frame) {
  // Wheel delivery and focus-driven scrolling can continue after the input promise resolves.
  await frame.evaluate(() => new Promise((resolve, reject) => {
    let previous = scrollY, stableFrames = 0;
    const deadline = performance.now() + 3000;
    const step = () => {
      stableFrames = scrollY === previous ? stableFrames + 1 : 0;
      previous = scrollY;
      if (stableFrames >= 4) resolve();
      else if (performance.now() >= deadline) reject(new Error('Scrolling did not settle'));
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
}
async function reset(frame, page) {
  await settled(frame);
  await frame.evaluate(() => scrollTo(0, 0));
  await settled(frame);
}
async function swipe(page, session, viewport) {
  const x = viewport.width - 8, y = viewport.height - 80;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 35 }] });
    await nextPaint(page);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(process.env.SCROLL_BROWSER_PATH ? { executablePath: process.env.SCROLL_BROWSER_PATH, headless: true } : { channel: 'chrome', headless: true });
  const evidence = [];
  try {
    for (const mobile of [false, true]) for (const embedded of [false, true]) {
      const viewport = mobile ? { width: 390, height: 700 } : { width: 1280, height: 600 };
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: 'zh-CN' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(origin + '/scroll-host', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html style="height:100%;overflow:hidden"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="height:100%;margin:0;overflow:hidden"><iframe title="theme shell" style="display:block;width:100%;height:100%;border:0" src="/scroll-shell"></iframe></body></html>` }));
      await page.route(origin + '/scroll-shell', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html style="height:100%;overflow:hidden"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="height:100%;margin:0;overflow:hidden"><iframe title="plugin" style="display:block;width:100%;height:100%;border:0" src="${pluginPath}"></iframe></body></html>` }));
      await page.goto(origin + (embedded ? '/scroll-host' : pluginPath));
      const frame = embedded ? await (await page.locator('iframe').elementHandle()).contentFrame().then(async shell => (await shell.locator('iframe').elementHandle()).contentFrame()) : page.mainFrame();
      await frame.locator(readySelector).waitFor();
      await frame.getByRole('checkbox').first().waitFor();
      await frame.evaluate(() => document.fonts.ready);
      const before = await frameMetrics(frame);
      assert(before.documentHeight > before.height + 20, 'fixture must overflow to exercise native scrolling');
      let after;
      if (mobile) {
        const session = await context.newCDPSession(page);
        await swipe(page, session, viewport);
        after = await waitForScroll(frame, before.y);
        await session.detach();
      } else {
        await page.mouse.move(viewport.width - 8, viewport.height / 2);
        await page.mouse.wheel(0, 480);
        after = await waitForScroll(frame, before.y);
      }
      await reset(frame, page);
      if (isAccount) await frame.getByRole('button', { name: '详情 / Details', exact: true }).first().click();
      else await frame.getByRole('button', { name: '清空全部测试记录', exact: true }).click();
      const dialog = frame.getByRole('dialog').first();
      await dialog.waitFor();
      await frame.waitForFunction(() => getComputedStyle(document.body).overflowY === 'hidden');
      await settled(frame);
      const locked = (await frameMetrics(frame)).y;
      await page.mouse.move(viewport.width - 8, viewport.height / 2);
      await page.mouse.wheel(0, 400);
      await settled(frame);
      assert.equal((await frameMetrics(frame)).y, locked, 'a modal must still lock the background');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await frame.waitForFunction(() => getComputedStyle(document.body).overflowY !== 'hidden');
      await reset(frame, page);
      if (mobile) {
        const session = await context.newCDPSession(page);
        await swipe(page, session, viewport);
        await waitForScroll(frame, 0); await session.detach();
      } else {
        await page.mouse.move(viewport.width - 8, viewport.height / 2);
        await page.mouse.wheel(0, 400);
        await waitForScroll(frame, 0);
      }
      assert.equal(errors.length, 0, errors.join('\n'));
      evidence.push({ mobile, embedded, input: mobile ? 'native touch swipe' : 'native mouse wheel', before: before.y, after, modalBackgroundLocked: true, restoredAfterEscape: true });
      await context.close();
    }
    console.log(JSON.stringify({ plugin: isAccount ? 'account-ops' : 'evaluation', scroll: evidence }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); server.close(); process.exitCode = 1; });
