import { type Page } from '@playwright/test';
import { test, expect, setup, slot, shown, settle } from './helpers';

const toast = (page: Page) => page.locator('#toast');
const selected = (page: Page) =>
  page.locator('.slot').evaluateAll((els) => els.findIndex((el) => el.classList.contains('selected')));

async function changedFrom(page: Page, before: (string | null)[]) {
  await expect.poll(() => shown(page)).not.toEqual(before);
  return settle(page);
}

test('E で編集モードに入ると、左端の画像が選択されて操作の案内が出る', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#modeLabel')).toBeHidden();

  await page.keyboard.press('e');
  await expect(toast(page)).toHaveText('編集モード');
  await expect(page.locator('body')).toHaveClass(/editing/);
  await expect(page.locator('#modeLabel')).toBeVisible();
  expect(await selected(page)).toBe(0);

  await page.keyboard.press('e');
  await expect(toast(page)).toHaveText('編集モードを終了');
  await expect(page.locator('#modeLabel')).toBeHidden();
  await expect(page.locator('.slot.selected')).toHaveCount(0);
});

test('← → で選択が左右に動き、端で止まる。画像は入れ替わらない', async ({ page }) => {
  await setup(page);
  const s0 = await settle(page);
  await page.keyboard.press('e');

  await page.keyboard.press('ArrowRight');
  expect(await selected(page)).toBe(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await selected(page)).toBe(2);
  await page.keyboard.press('ArrowLeft');
  expect(await selected(page)).toBe(1);

  expect(await settle(page)).toEqual(s0);
});

test('マウスを乗せた画像が選択され、クリックしても入れ替わらない', async ({ page }) => {
  await setup(page);
  const s0 = await settle(page);
  await page.keyboard.press('e');

  await slot(page, 2).hover();
  expect(await selected(page)).toBe(2);
  await slot(page, 1).click();
  expect(await selected(page)).toBe(1);
  expect(await settle(page)).toEqual(s0);
});

test('Space で並び全体が次へ、Shift+Space で前の並びに戻る', async ({ page }) => {
  await setup(page);
  const s0 = await settle(page);
  await page.keyboard.press('e');
  await page.keyboard.press('ArrowRight');

  await page.keyboard.press(' ');
  const s1 = await changedFrom(page, s0);
  for (const name of s1) expect(s0).not.toContain(name); // 入れ替え方が「1枚ずつ」でも全部入れ替わる
  expect(await selected(page)).toBe(1); // 選択位置はそのまま

  await page.keyboard.press('Shift+ ');
  expect(await changedFrom(page, s1)).toEqual(s0);
  await expect(page.locator('body')).toHaveClass(/editing/); // Space で再生には戻らない
});

test('編集モード中は自動で進まず、終えると再生に戻る', async ({ page }) => {
  await setup(page, { settings: { interval: 1 } });
  await page.keyboard.press('e');
  const s0 = await settle(page);
  await page.waitForTimeout(2000);
  expect(await shown(page)).toEqual(s0);

  await page.keyboard.press('e');
  await changedFrom(page, s0);
});

test('一時停止中に入って出ても、一時停止のまま', async ({ page }) => {
  await setup(page, { settings: { interval: 1 } });
  await page.keyboard.press(' ');
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  const s0 = await settle(page);
  await page.waitForTimeout(2000);
  expect(await shown(page)).toEqual(s0);
});

test('1枚表示では ← → で前へ / 次へ', async ({ page }) => {
  await setup(page, { settings: { mode: 1 } });
  const s0 = await settle(page);
  await page.keyboard.press('e');
  expect(await selected(page)).toBe(0);

  await page.keyboard.press('ArrowRight');
  const s1 = await changedFrom(page, s0);
  await page.keyboard.press('ArrowLeft');
  expect(await changedFrom(page, s1)).toEqual(s0);
});

test('Esc は編集モードを終えるだけで、最初の画面には戻らない', async ({ page }) => {
  await setup(page);
  await page.keyboard.press('e');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/editing/);
  await expect(page.locator('#start')).toBeHidden();
});

test('通常モードの D は、編集モードに入るよう案内する', async ({ page }) => {
  await setup(page);
  await page.keyboard.press('d');
  await expect(toast(page)).toHaveText('E で編集モードに入ると、削除候補を選べます');
  await expect(page.locator('.slot.marked')).toHaveCount(0);
});

test('1枚 → 3枚に切り替えても、編集モードと選択が続く', async ({ page }) => {
  await setup(page, { settings: { mode: 1 } });
  await page.keyboard.press('e');
  await page.keyboard.press('3');
  await expect(page.locator('.slot')).toHaveCount(3);
  await expect.poll(() => selected(page)).toBeGreaterThanOrEqual(0);
  await expect(page.locator('body')).toHaveClass(/editing/);
});
