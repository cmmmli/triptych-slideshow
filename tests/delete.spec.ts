import { test, expect, type Page } from '@playwright/test';

// フォルダ選択ダイアログと書き込み許可のダイアログは OS の画面なので自動操作できない。
// そこで showDirectoryPicker を差し替え、ブラウザ内のストレージ（OPFS）に作ったフォルダを返す。
// OPFS のハンドルは実際のフォルダと同じ API で動き、許可は最初から付いている。

// テスト用フォルダの中身（縦長の PNG を生成する）
const FIXTURE = ['a.png', 'b.png', 'sub/c.png', 'sub/d.png'];

type Options = { denyWrite?: boolean };

async function setup(page: Page, { denyWrite = false }: Options = {}) {
  await page.addInitScript(
    ({ names, denyWrite }) => {
      // 自動で次の画像に進まないよう、表示間隔を長くしておく
      localStorage.setItem('triptych-settings', JSON.stringify({ interval: 120 }));

      window.showDirectoryPicker = async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('photos', { recursive: true }).catch(() => {});
        const dir = await root.getDirectoryHandle('photos', { create: true });
        for (const [n, path] of names.entries()) {
          const parts = path.split('/');
          let parent = dir;
          for (const p of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(p, { create: true });
          const canvas = new OffscreenCanvas(400, 600);
          const g = canvas.getContext('2d')!;
          g.fillStyle = `hsl(${n * 80} 60% 45%)`;
          g.fillRect(0, 0, 400, 600);
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          const w = await (await parent.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
          await w.write(blob);
          await w.close();
        }
        if (denyWrite) {
          // 書き込みの許可ダイアログで「許可しない」を選んだ状態
          Object.assign(dir, {
            queryPermission: async () => 'prompt',
            requestPermission: async () => 'denied',
          });
        }
        return dir;
      };
    },
    { names: FIXTURE, denyWrite },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'フォルダを選択' }).click();
  await expect(page.locator('#toast')).toHaveText(`${FIXTURE.length} 枚の画像を読み込みました`);
  await expect(page.locator('.slot img.show')).toHaveCount(3);
}

// テスト用フォルダに残っているファイル（"sub/c.png" の形）
function filesOnDisk(page: Page) {
  return page.evaluate(async () => {
    const out: string[] = [];
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const h of dir.values()) {
        if (h.kind === 'directory') await walk(h as FileSystemDirectoryHandle, `${prefix}${h.name}/`);
        else out.push(prefix + h.name);
      }
    };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('photos'), '');
    return out.sort();
  });
}

const slot = (page: Page, k: number) => page.locator('.slot').nth(k);
// "photos/sub/c.png" → "sub/c.png"
const shownName = async (page: Page, k: number) =>
  (await slot(page, k).locator('.cap').textContent())!.replace(/^photos\//, '');

test('D で印を付けた画像を X の一覧から削除できる', async ({ page }) => {
  await setup(page);
  const target = await shownName(page, 1);

  await slot(page, 1).hover();
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
  await expect(page.locator('.slot .cap')).not.toContainText([`photos/${target}`]);
});

test('印はもう一度 D を押すか、一覧でクリックすると外せる', async ({ page }) => {
  await setup(page);

  await slot(page, 0).hover();
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await expect(slot(page, 0)).not.toHaveClass(/marked/);
  await expect(page.locator('#toast')).toHaveText('削除候補から外しました（0 枚）');

  await slot(page, 2).hover();
  await page.keyboard.press('d');
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
  await setup(page);
  await page.keyboard.press('1'); // 1枚表示なら、マウスの位置に関係なく表示中の画像が対象

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
  await setup(page, { denyWrite: true });

  await slot(page, 0).hover();
  await page.keyboard.press('d');
  await page.keyboard.press('x');
  await page.getByRole('button', { name: '1 枚を削除する' }).click();

  await expect(page.locator('#toast')).toHaveText('フォルダへの書き込みが許可されませんでした');
  await expect(page.locator('#trash')).toBeVisible();
  expect(await filesOnDisk(page)).toEqual([...FIXTURE].sort());
});

test('削除候補があるときの Esc は、1回目は警告だけ', async ({ page }) => {
  await setup(page);

  await slot(page, 0).hover();
  await page.keyboard.press('d');
  await page.keyboard.press('Escape');
  await expect(page.locator('#toast')).toHaveText('削除候補が 1 枚あります（もう一度押すと候補を捨てて移動）');
  await expect(page.locator('#start')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.locator('#start')).toBeVisible();
});

test('「ファイルを選択」で開いた画像は削除できない', async ({ page }) => {
  await page.goto('/');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR4nGNgYGD4z8DAAAAEAAH6Lc3/AAAAAElFTkSuQmCC',
    'base64',
  ); // 1x2 の縦長 PNG
  await page.locator('#fileInput').setInputFiles([
    { name: 'x.png', mimeType: 'image/png', buffer: png },
    { name: 'y.png', mimeType: 'image/png', buffer: png },
  ]);
  await page.keyboard.press('1');
  await expect(page.locator('.slot img.show')).toHaveCount(1);

  await page.keyboard.press('d');
  await expect(page.locator('#toast')).toHaveText('この読み込み方では削除できません（「フォルダを選択」で開いてください）');
  await expect(page.locator('.slot.marked')).toHaveCount(0);
});
