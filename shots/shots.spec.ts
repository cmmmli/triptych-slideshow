import { test, type Page } from '@playwright/test';
import { setup, settle, type FixtureImage } from '../tests/helpers';

// 主な画面を screenshots/<名前>.png に保存する。画面を足したらここにも足す。
// 画像は枠とファイル名入りの単色（tests/helpers.ts の putImage）。並びが毎回同じになるようシャッフルは切る

// スマホの写真によくある 3:4 の縦長
const portraits = (n: number): FixtureImage[] =>
  Array.from({ length: n }, (_, i) => ({ path: `p${i}.png`, w: 300, h: 400 }));

async function shot(page: Page, name: string, { keepToast = false } = {}) {
  if (!keepToast) await page.locator('#toast').evaluate((el) => el.classList.remove('show'));
  await page.screenshot({ path: `screenshots/${name}.png`, animations: 'disabled' });
}

test('start', async ({ page }) => {
  await page.goto('/');
  await shot(page, 'start');
});

test('start-url', async ({ page }) => {
  await page.goto('/');
  await page.getByText('画像の URL から再生').click();
  await page.locator('#urlInput').fill('https://example.com/a.jpg\nhttps://example.com/b.png');
  await shot(page, 'start-url');
});

test('triptych', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false } });
  await settle(page);
  await shot(page, 'triptych');
});

test('triptych-toast', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false } });
  await settle(page);
  await shot(page, 'triptych-toast', { keepToast: true });
});

test('single', async ({ page }) => {
  await setup(page, { images: portraits(3), settings: { shuffle: false, mode: 1 } });
  await settle(page);
  await shot(page, 'single');
});

test('mixed', async ({ page }) => {
  // フォルダはファイル名順に読まれるので、縦長と横長が交互になるよう名前を付ける
  const images = Array.from({ length: 6 }, (_, i) =>
    i % 2 ? { path: `m${i}-land.png`, w: 400, h: 300 } : { path: `m${i}-port.png`, w: 300, h: 400 },
  );
  await setup(page, { images, settings: { shuffle: false, portraitOnly: false } });
  await settle(page);
  await shot(page, 'mixed');
});

test('cover-gap-info', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false, fit: 'cover', gap: true, info: true } });
  await settle(page);
  await shot(page, 'cover-gap-info');
});

test('edit-mode', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false } });
  await settle(page);
  await page.keyboard.press('e');
  await page.keyboard.press('d');
  await page.keyboard.press('ArrowRight');
  await shot(page, 'edit-mode');
});

test('trash', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false } });
  await settle(page);
  await page.keyboard.press('e');
  for (const key of ['d', 'ArrowRight', 'd']) await page.keyboard.press(key);
  await page.keyboard.press('x');
  await shot(page, 'trash');
});

test('help', async ({ page }) => {
  await setup(page, { images: portraits(6), settings: { shuffle: false } });
  await settle(page);
  await page.keyboard.press('h');
  await shot(page, 'help');
});
