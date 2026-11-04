import { test, expect, type Page } from '@playwright/test';
import { setup, portraits, slot, shown, settle } from './helpers';

const toast = (page: Page) => page.locator('#toast');

// 表示が before から変わるのを待って、変わった後の表示を返す
async function changedFrom(page: Page, before: (string | null)[]) {
  await expect.poll(() => shown(page)).not.toEqual(before);
  return settle(page);
}

test.describe('読み込み', () => {
  test('3枚横並びで、違う画像が3枚表示される', async ({ page }) => {
    await setup(page);
    const s = await settle(page);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(s).not.toContain(null);
  });

  test('Esc で最初の画面に戻り、「前回のフォルダ」から開き直せる', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#start')).toBeVisible();

    await page.getByRole('button', { name: '前回のフォルダ「photos」を開く' }).click();
    await expect(page.locator('#start')).toBeHidden();
    await expect(toast(page)).toHaveText('8 枚の画像を読み込みました');
  });
});

test.describe('次へ・前へ', () => {
  test('→ で1枚ずつ左から順番に入れ替わる', async ({ page }) => {
    await setup(page);
    const s0 = await settle(page);

    await page.keyboard.press('ArrowRight');
    const s1 = await changedFrom(page, s0);
    expect(s1.slice(1)).toEqual(s0.slice(1));
    expect(s0).not.toContain(s1[0]);

    await page.keyboard.press('ArrowRight');
    const s2 = await changedFrom(page, s1);
    expect([s2[0], s2[2]]).toEqual([s1[0], s1[2]]);
  });

  test('← で履歴を戻り、→ で同じ並びに進み直せる', async ({ page }) => {
    await setup(page);
    const s0 = await settle(page);
    await page.keyboard.press('ArrowRight');
    const s1 = await changedFrom(page, s0);

    await page.keyboard.press('ArrowLeft');
    expect(await changedFrom(page, s1)).toEqual(s0);
    await page.keyboard.press('ArrowRight');
    expect(await changedFrom(page, s0)).toEqual(s1);
  });

  test('最初の並びで ← を押すと、履歴がないと表示される', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('ArrowLeft');
    await expect(toast(page)).toHaveText('これより前の履歴はありません');
  });

  test('クリックした枠だけ入れ替わる', async ({ page }) => {
    await setup(page);
    const s0 = await settle(page);
    await slot(page, 2).click();
    const s1 = await changedFrom(page, s0);
    expect(s1.slice(0, 2)).toEqual(s0.slice(0, 2));
    expect(s0).not.toContain(s1[2]);
  });

  test('C で入れ替え方を切り替え、「全部まとめて」なら3枚とも入れ替わる', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('c');
    await expect(toast(page)).toHaveText('入れ替え方：1枚ずつランダム');
    await page.keyboard.press('c');
    await expect(toast(page)).toHaveText('入れ替え方：全部まとめて');

    const s0 = await settle(page);
    await page.keyboard.press('ArrowRight');
    const s1 = await changedFrom(page, s0);
    for (const name of s1) expect(s0).not.toContain(name);

    await page.keyboard.press('c');
    await expect(toast(page)).toHaveText('入れ替え方：1枚ずつ順番');
  });
});

test.describe('再生', () => {
  test('表示間隔ごとに自動で次へ進み、Space で止まる', async ({ page }) => {
    await setup(page, { settings: { interval: 1 } });
    const s0 = await settle(page);
    await changedFrom(page, s0); // 1秒後に自動で進む

    await page.keyboard.press(' ');
    await expect(toast(page)).toHaveText('⏸ 一時停止');
    const paused = await settle(page);
    await page.waitForTimeout(2000);
    expect(await shown(page)).toEqual(paused);

    await page.keyboard.press(' ');
    await expect(toast(page)).toHaveText('▶ 再生');
    await changedFrom(page, paused);
  });

  test('+ / - で表示間隔を変える', async ({ page }) => {
    await setup(page, { settings: { interval: 5 } });
    await page.keyboard.press('+');
    await expect(toast(page)).toHaveText('表示間隔 8 秒');
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    await expect(toast(page)).toHaveText('表示間隔 3 秒');
  });
});

test.describe('表示モード', () => {
  test('1 で1枚表示、3 で3枚に戻すと今の画像が中央に来る', async ({ page }) => {
    await setup(page);
    const s0 = await settle(page);

    await page.keyboard.press('1');
    await expect(toast(page)).toHaveText('1枚表示');
    await expect(page.locator('.slot')).toHaveCount(1);
    const one = await settle(page);
    expect(one).toEqual([s0[0]]);

    await page.keyboard.press('3');
    await expect(page.locator('.slot')).toHaveCount(3);
    await expect.poll(async () => (await shown(page)).filter(Boolean).length).toBe(3);
    expect((await settle(page))[1]).toBe(one[0]);
  });

  test('1枚表示の → は1枚ずつ進む', async ({ page }) => {
    await setup(page, { settings: { mode: 1 } });
    const s0 = await settle(page);
    await page.keyboard.press('ArrowRight');
    const s1 = await changedFrom(page, s0);
    expect(s1).toHaveLength(1);
    expect(s1[0]).not.toBe(s0[0]);
  });

  test('3枚表示で「縦長画像のみ」が ON なら横長は出ない', async ({ page }) => {
    const images = [...portraits(4), ...Array.from({ length: 4 }, (_, i) => ({ path: `l${i}.png`, w: 600, h: 400 }))];
    await setup(page, { images, settings: { change: 'all' } });
    for (let n = 0; n < 5; n++) {
      const s = await settle(page);
      for (const name of s) expect(name).toMatch(/^p/);
      await page.keyboard.press('ArrowRight');
    }
  });

  test('「縦長画像のみ」を OFF にすると横長も並べ、幅は画像の比率に合わせる', async ({ page }) => {
    const images = Array.from({ length: 3 }, (_, i) => ({ path: `l${i}.png`, w: 600, h: 400 }));
    await setup(page, { images });
    await page.keyboard.press('p');
    await expect(toast(page)).toHaveText('縦長画像のみ OFF（横長も混ぜて並べる）');
    // 3:2 の横長は画面に1枚しか入らないので、残りの枠は空になる
    await expect.poll(async () => (await shown(page)).filter(Boolean).length).toBe(1);
    await expect(page.locator('.slot.empty')).toHaveCount(2);
  });

  test('Z / G / I で見た目の設定を切り替える', async ({ page }) => {
    await setup(page);
    const stage = page.locator('#stage');
    await page.keyboard.press('z');
    await expect(stage).toHaveClass(/cover/);
    await page.keyboard.press('g');
    await expect(stage).toHaveClass(/gap/);
    await page.keyboard.press('i');
    await expect(stage).toHaveClass(/info/);
    await expect(slot(page, 0).locator('.cap')).toBeVisible();
    await page.keyboard.press('z');
    await expect(stage).not.toHaveClass(/cover/);
  });

  test('H でキー操作一覧を開閉する', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('h');
    await expect(page.locator('#help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#help')).toBeHidden();
    await expect(page.locator('#start')).toBeHidden();
  });
});
