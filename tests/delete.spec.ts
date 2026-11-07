import { test, expect, setup, filesOnDisk, slot, shown, tinyPortraitPng as png } from './helpers';

const FIXTURE = ['a.png', 'b.png', 'sub/c.png', 'sub/d.png'];
const images = FIXTURE.map((path) => ({ path }));

test('編集モードの D で印を付けた画像を X の一覧から削除できる', async ({ page }) => {
  await setup(page, { images });
  await expect(page.locator('.slot img.show')).toHaveCount(3);
  const target = (await shown(page))[1]!;

  await page.keyboard.press('e');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('d');
  await expect(slot(page, 1)).toHaveClass(/marked/);
  await expect(page.locator('#toast')).toHaveText('削除候補に追加（1 枚、X で確認）');

  await page.keyboard.press('x');
  await expect(page.locator('#trash')).toBeVisible();
  await expect(page.locator('#trashList .thumb')).toHaveText([`photos/${target}`]);

  await page.getByRole('button', { name: '1 枚を削除する' }).click();
  await expect(page.locator('#toast')).toHaveText('1 枚を削除しました');
  await expect(page.locator('#trash')).toBeHidden();

  expect(await filesOnDisk(page)).toEqual(FIXTURE.filter((f) => f !== target).sort());
  // 削除した画像は表示から外れている
  await expect.poll(() => shown(page)).not.toContain(target);
});

test('印はもう一度 D を押すか、一覧でクリックすると外せる', async ({ page }) => {
  await setup(page, { images });

  await page.keyboard.press('e');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await expect(slot(page, 0)).not.toHaveClass(/marked/);
  await expect(page.locator('#toast')).toHaveText('削除候補から外しました（0 枚）');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('d');
  await expect(slot(page, 2)).toHaveClass(/marked/);
  await page.keyboard.press('x');
  await page.locator('#trashList .thumb').click();
  await expect(page.locator('#trashList .thumb')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '0 枚を削除する' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(page.locator('#trash')).toBeHidden();
  await expect(page.locator('.slot.marked')).toHaveCount(0);
  expect(await filesOnDisk(page)).toEqual([...FIXTURE].sort());
});

test('すべて削除すると最初の画面に戻る（サブフォルダの画像も消える）', async ({ page }) => {
  await setup(page, { images, settings: { mode: 1 } });
  await page.keyboard.press('e');

  // 印を付けた画像は出なくなるので、次へ進みながら全部に印を付ける
  for (let n = 1; n <= FIXTURE.length; n++) {
    await expect(page.locator('.slot.marked')).toHaveCount(0);
    await page.keyboard.press('d');
    await expect(page.locator('#toast')).toHaveText(`削除候補に追加（${n} 枚、X で確認）`);
    if (n < FIXTURE.length) await page.keyboard.press('ArrowRight');
  }

  await page.keyboard.press('x');
  await page.getByRole('button', { name: `${FIXTURE.length} 枚を削除する` }).click();
  await expect(page.locator('#start')).toBeVisible();
  expect(await filesOnDisk(page)).toEqual([]);
});

test('書き込みが許可されなければ何も削除しない', async ({ page }) => {
  await setup(page, { images, denyWrite: true });

  await page.keyboard.press('e');
  await page.keyboard.press('d');
  await page.keyboard.press('x');
  await page.getByRole('button', { name: '1 枚を削除する' }).click();

  await expect(page.locator('#toast')).toHaveText('フォルダへの書き込みが許可されませんでした');
  await expect(page.locator('#trash')).toBeVisible();
  expect(await filesOnDisk(page)).toEqual([...FIXTURE].sort());
});

test('削除候補があるときの Esc は、1回目は警告だけ', async ({ page }) => {
  await setup(page, { images });

  await page.keyboard.press('e');
  await page.keyboard.press('d');
  await page.keyboard.press('Escape'); // 編集モードを終える
  await expect(page.locator('body')).not.toHaveClass(/editing/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#toast')).toHaveText('削除候補が 1 枚あります（もう一度押すと候補を捨てて移動）');
  await expect(page.locator('#start')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.locator('#start')).toBeVisible();
});

test('「ファイルを選択」で開いた画像は削除できない', async ({ page }) => {
  await page.goto('/');
  await page.locator('#fileInput').setInputFiles([
    { name: 'x.png', mimeType: 'image/png', buffer: png },
    { name: 'y.png', mimeType: 'image/png', buffer: png },
  ]);
  await page.keyboard.press('1');
  await expect(page.locator('.slot img.show')).toHaveCount(1);

  await page.keyboard.press('e');
  await page.keyboard.press('d');
  await expect(page.locator('#toast')).toHaveText(
    'この読み込み方では削除できません（「フォルダを選択」で開いてください）',
  );
  await expect(page.locator('.slot.marked')).toHaveCount(0);
});
