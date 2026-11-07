import { type Page } from '@playwright/test';
import { test, expect, setup, portraits, shown, settle, tinyPortraitPng } from './helpers';

const toast = (page: Page) => page.locator('#toast');

test.describe('画像の URL から再生', () => {
  // 外部には通信せず、テスト用の画像を返す
  test.beforeEach(async ({ page }) => {
    await page.route('https://img.example.test/**', (route) =>
      route.fulfill({ contentType: 'image/png', body: tinyPortraitPng }),
    );
    await page.goto('/');
    await page.getByText('画像の URL から再生').click();
  });

  test('https の URL だけを読み込み、それ以外の行はスキップする', async ({ page }) => {
    await page
      .locator('#urlInput')
      .fill(
        [
          '# コメントは無視',
          'https://img.example.test/a.png',
          'http://img.example.test/insecure.png',
          'not a url',
          '',
          'https://img.example.test/dir/b%20c.png',
          'https://img.example.test/d.png',
        ].join('\n'),
      );
    await page.getByRole('button', { name: 'URL で再生' }).click();

    await expect(toast(page)).toHaveText('3 件を読み込みました（2 行はスキップ）');
    expect([...(await settle(page))].sort()).toEqual(['a.png', 'b c.png', 'd.png']);
  });

  test('https の URL がなければ、最初の画面のまま', async ({ page }) => {
    await page.locator('#urlInput').fill('http://img.example.test/a.png');
    await page.getByRole('button', { name: 'URL で再生' }).click();
    await expect(toast(page)).toHaveText('https の画像 URL が見つかりませんでした');
    await expect(page.locator('#start')).toBeVisible();
  });

  test('入力した URL はページを開き直しても残る', async ({ page }) => {
    await page.locator('#urlInput').fill('https://img.example.test/a.png');
    await page.reload();
    await expect(page.locator('#urlBox')).toHaveAttribute('open', '');
    await expect(page.locator('#urlInput')).toHaveValue('https://img.example.test/a.png');
  });

  test('URL の入力中はキー操作が効かない', async ({ page }) => {
    await page.locator('#urlInput').fill('');
    await page.locator('#urlInput').press('h');
    await expect(page.locator('#help')).toBeHidden();
    await expect(page.locator('#urlInput')).toHaveValue('h');
  });
});

test('ドロップした画像を読み込み、画像以外のファイルは無視する', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const png = async (n: number) => {
      const canvas = new OffscreenCanvas(400, 600);
      const g = canvas.getContext('2d')!;
      g.fillStyle = `hsl(${n * 47} 60% 45%)`;
      g.fillRect(0, 0, 400, 600);
      return new File([await canvas.convertToBlob({ type: 'image/png' })], `d${n}.png`, { type: 'image/png' });
    };
    const dt = new DataTransfer();
    for (let n = 0; n < 3; n++) dt.items.add(await png(n));
    dt.items.add(new File(['memo'], 'memo.txt', { type: 'text/plain' }));
    document.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, cancelable: true }));
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }));
  });

  await expect(toast(page)).toHaveText('3 枚の画像を読み込みました');
  expect([...(await settle(page))].sort()).toEqual(['d0.png', 'd1.png', 'd2.png']);
  await expect(page.locator('#start')).not.toHaveClass(/drag/);
});

test('Finder の「このアプリケーションで開く」から渡された画像を表示する', async ({ page }) => {
  // launchQueue はインストールしたアプリでしか画像を渡さないので、受け取り口を差し替えて呼ぶ
  await page.addInitScript(() => {
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: (fn: unknown) => Object.assign(window, { launchConsumer: fn }) },
    });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handles = [];
    for (let n = 0; n < 2; n++) {
      const canvas = new OffscreenCanvas(400, 600);
      canvas.getContext('2d')!.fillRect(0, 0, 400, 600);
      const h = await root.getFileHandle(`f${n}.png`, { create: true });
      const w = await h.createWritable();
      await w.write(await canvas.convertToBlob({ type: 'image/png' }));
      await w.close();
      handles.push(h);
    }
    const consume = (window as unknown as { launchConsumer: (p: { files: FileSystemHandle[] }) => Promise<void> })
      .launchConsumer;
    await consume({ files: handles });
  });

  await expect(toast(page)).toHaveText('2 枚の画像を読み込みました');
  await expect(page.locator('#start')).toBeHidden();
});

test('O で別のフォルダを開き直せる', async ({ page }) => {
  await setup(page, { images: portraits(4) });
  // 同じ文言のトーストがもう一度出たと分かるよう、いったん消す
  await toast(page).evaluate((el) => (el.textContent = ''));
  await page.keyboard.press('o');
  await expect(toast(page)).toHaveText('4 枚の画像を読み込みました');
});

test('設定はページを開き直しても残る', async ({ page }) => {
  await page.goto('/');
  // 最初の画面でも設定は変えられる
  for (const key of ['1', 'c', 's', 'z', 'g', 'i', '+']) await page.keyboard.press(key);
  await expect(toast(page)).toHaveText('表示間隔 8 秒');

  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('triptych-settings')!));
  expect(saved).toMatchObject({
    mode: 1,
    change: 'rand',
    shuffle: false,
    fit: 'cover',
    gap: true,
    info: true,
    interval: 8,
  });

  await page
    .locator('#fileInput')
    .setInputFiles(['a.png', 'b.png'].map((name) => ({ name, mimeType: 'image/png', buffer: tinyPortraitPng })));
  await expect(page.locator('.slot img.show').first()).toBeVisible();
  await expect(page.locator('.slot')).toHaveCount(1);
  for (const cls of [/cover/, /gap/, /info/]) await expect(page.locator('#stage')).toHaveClass(cls);
});

test.describe('エラーの検出（共通 fixture 自体のテスト）', () => {
  // ここのテストは fixture が失敗にすることを確かめるので、失敗するのが正しい
  test.fail('ページで例外が出たら失敗する', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => setTimeout(() => (null as unknown as { x: number }).x));
    await expect(page.locator('#start')).toBeVisible();
    await page.waitForTimeout(100);
  });

  test.fail('CSP で禁止した通信をしたら失敗する', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => fetch('https://example.com/').catch(() => {}));
    await page.waitForTimeout(100);
  });

  test.describe(() => {
    test.use({ allowedErrors: [/Content Security Policy|CSP violation/] });
    test('allowedErrors で除外したエラーなら失敗しない', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => fetch('https://example.com/').catch(() => {}));
      await page.waitForTimeout(100);
    });
  });
});
