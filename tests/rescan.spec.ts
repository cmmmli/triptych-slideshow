import { type Page } from '@playwright/test';
import {
  test,
  expect,
  setup,
  portraits,
  shown,
  settle,
  addImages,
  removeFiles,
  tinyPortraitPng as png,
} from './helpers';

const toast = (page: Page) => page.locator('#toast');

// 1枚表示なら、画像の枚数だけ → を押すと一巡する
const single = { mode: 1 };

test('R でフォルダを読み直すと、増えた画像が次に出る', async ({ page }) => {
  await setup(page, { images: portraits(3), settings: single });

  await addImages(page, ['new.png']);
  await page.keyboard.press('r');
  await expect(toast(page)).toHaveText('フォルダを読み直しました（1 枚追加）');

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => shown(page)).toEqual(['new.png']);
});

test('R で読み直すと、フォルダからなくなった画像は表示から外れる', async ({ page }) => {
  await setup(page, { images: portraits(4) });
  const target = (await settle(page))[1]!;

  await removeFiles(page, [target]);
  await page.keyboard.press('r');
  await expect(toast(page)).toHaveText('フォルダを読み直しました（1 枚なくなった）');
  await expect.poll(() => shown(page)).not.toContain(target);
  expect(await settle(page)).not.toContain(null);
});

test('変更がなければ、そう表示する', async ({ page }) => {
  await setup(page);
  await page.keyboard.press('r');
  await expect(toast(page)).toHaveText('フォルダに変更はありません');
});

test('全部を一巡すると、自動でフォルダを読み直す', async ({ page }) => {
  await setup(page, { images: portraits(3), settings: single });
  const seen = await settle(page);
  await addImages(page, ['new.png']);

  // 残りの2枚を出し終えるまでは読み直さない
  for (let n = 0; n < 2; n++) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => shown(page)).not.toEqual(seen.slice(-1));
    seen.push(...(await settle(page)));
  }
  expect(new Set(seen).size).toBe(3);
  await expect(toast(page)).not.toHaveText(/読み直しました/);

  // 次の画像を選ぶときに一巡したので読み直し、その次に増えた画像が出る
  await page.keyboard.press('ArrowRight');
  await expect(toast(page)).toHaveText('フォルダを読み直しました（1 枚追加）');
  await expect.poll(() => shown(page)).not.toEqual(seen.slice(-1));
  await settle(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => shown(page)).toEqual(['new.png']);
});

test('「ファイルを選択」で開いたときは読み直せない', async ({ page }) => {
  await page.goto('/');
  await page.locator('#fileInput').setInputFiles([{ name: 'x.png', mimeType: 'image/png', buffer: png }]);
  await expect(page.locator('.slot img.show').first()).toBeVisible();

  await page.keyboard.press('r');
  await expect(toast(page)).toHaveText('読み直せるのは「フォルダを選択」で開いたときだけです');
});
