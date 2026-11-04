import { expect, type Page } from '@playwright/test';

// フォルダ選択ダイアログと書き込み許可のダイアログは OS の画面なので自動操作できない。
// そこで showDirectoryPicker を差し替え、ブラウザ内のストレージ（OPFS）に作ったフォルダを返す。
// OPFS のハンドルは実際のフォルダと同じ API で動き、許可は最初から付いている。

// TypeScript の DOM の型にはまだ入っていない
declare global {
  interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }
}

// テスト用フォルダに置く画像。w / h を省略すると縦長（400x600）
export type FixtureImage = { path: string; w?: number; h?: number };

export const portraits = (n: number, dir = ''): FixtureImage[] =>
  Array.from({ length: n }, (_, i) => ({ path: `${dir}p${i}.png` }));

export type SetupOptions = {
  images?: FixtureImage[];
  settings?: Record<string, unknown>; // localStorage の triptych-settings に入れる値
  denyWrite?: boolean; // 書き込みの許可ダイアログで「許可しない」を選んだ状態にする
};

export async function setup(
  page: Page,
  { images = portraits(8), settings = {}, denyWrite = false }: SetupOptions = {},
) {
  await page.addInitScript(
    ({ images, settings, denyWrite }) => {
      // 既定では自動で次の画像に進まないよう、表示間隔を長くしておく
      localStorage.setItem('triptych-settings', JSON.stringify({ interval: 120, ...settings }));

      window.showDirectoryPicker = async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('photos', { recursive: true }).catch(() => {});
        const dir = await root.getDirectoryHandle('photos', { create: true });
        for (const [n, { path, w = 400, h = 600 }] of images.entries()) {
          const parts = path.split('/');
          let parent = dir;
          for (const p of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(p, { create: true });
          const canvas = new OffscreenCanvas(w, h);
          const g = canvas.getContext('2d')!;
          g.fillStyle = `hsl(${n * 47} 60% 45%)`;
          g.fillRect(0, 0, w, h);
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          const file = await (await parent.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
          await file.write(blob);
          await file.close();
        }
        if (denyWrite) {
          Object.assign(dir, {
            queryPermission: async () => 'prompt',
            requestPermission: async () => 'denied',
          });
        }
        return dir;
      };
    },
    { images, settings, denyWrite },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'フォルダを選択' }).click();
  await expect(page.locator('#toast')).toHaveText(`${images.length} 枚の画像を読み込みました`);
  await expect(page.locator('.slot img.show').first()).toBeVisible();
}

// テスト用フォルダに残っているファイル（"sub/c.png" の形）
export function filesOnDisk(page: Page) {
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

export const slot = (page: Page, k: number) => page.locator('.slot').nth(k);

// 各枠に表示中の画像のパス（"photos/" は除く）。空の枠は null
export function shown(page: Page) {
  return page
    .locator('.slot')
    .evaluateAll((els) =>
      els.map((el) =>
        el.classList.contains('empty') || !el.querySelector('img.show')
          ? null
          : el.querySelector('.cap')!.textContent!.replace(/^photos\//, ''),
      ),
    );
}

// 画面の切り替え（画像の decode）が終わって、表示が落ち着くまで待つ
export async function settle(page: Page) {
  let prev = JSON.stringify(await shown(page));
  for (let t = 0; t < 20; t++) {
    await page.waitForTimeout(100);
    const cur = JSON.stringify(await shown(page));
    if (cur === prev && t >= 2) return JSON.parse(cur) as (string | null)[];
    prev = cur;
  }
  return JSON.parse(prev) as (string | null)[];
}
