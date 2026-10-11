// Run against Vite: node tests/fixtures/check-favourites.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 820 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.TEST_ORIGIN ?? 'http://127.0.0.1:5199'}/tests/fixtures/favourites.html`);
  await page.waitForFunction(() => window.fixture);
  const select = name => page.evaluate(name => {
    const toolbox = window.fixture.ws.getToolbox();
    toolbox.setSelectedItem(toolbox.getToolboxItems().find(item => item.getName?.() === name));
  }, name);
  await select('Game');
  await page.locator('.ab-favourite-star').nth(2).tap();
  await page.waitForTimeout(100);
  await page.locator('.ab-favourite-star').first().click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.ab-favourite-star[aria-pressed="true"]').count(), 2);
  assert.equal(await page.evaluate(() => window.fixture.ws.getAllBlocks(false).length), 1);
  await select('Sprites');
  await page.locator('.ab-favourite-star').nth(7).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await select('Favourites');
  await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('.ab-favourite-heading').allTextContents(), ['Game', 'Sprites']);
  assert.equal(await page.locator('.ab-favourite-heading line').count(), 4);
  assert.equal(await page.locator('.ab-favourite-star[aria-pressed="true"]').count(), 3);
  assert.deepEqual(await page.evaluate(() => window.fixture.ws.getFlyout().getWorkspace().getTopBlocks(true).map(b => b.type)), ['ab_on_start', 'ab_on_every', 'ab_sprite_say_for']);
  await page.screenshot({ path: 'docs/images/favourites.png' });
  const point = await page.evaluate(() => {
    const block = window.fixture.ws.getFlyout().getWorkspace().getTopBlocks(true)[2];
    const bounds = block.getSvgRoot().getBoundingClientRect();
    return { x: bounds.x + bounds.width - 24, y: bounds.y + 15 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(950, 550, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.fixture.ws.getAllBlocks(false).filter(b => b.type === 'ab_sprite_say_for').length), 1);
  assert.equal(await page.evaluate(() => window.fixture.ws.getAllBlocks(false).flatMap(b => b.getIcons()).filter(i => i.getType().toString() === 'ab_favourite').length), 0);
  await select('Game');
  await select('Favourites');
  await page.locator('.ab-favourite-star').first().focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.fixture.project.favouriteBlocks.length), 2);
  assert.equal(await page.locator('.ab-favourite-star').count(), 2);
  assert.deepEqual(errors, []);
  console.log('Favourites: mouse, touch, keyboard, ordering, menu-only icons and removal passed.');
} finally { await browser.close(); }
