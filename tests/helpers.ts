import { test as base, expect, type Page } from '@playwright/test';

export { expect };

// すべてのテストで、ページの例外・console.error・CSP 違反が出たら失敗にする。
// 検証していない箇所が壊れても気づけるようにするため。
// わざとエラーを起こすテストは test.use({ allowedErrors: [/.../] }) で除外する
export const test = base.extend<{ allowedErrors: RegExp[]; pageErrors: string[] }>({
  allowedErrors: [[], { option: true }],
  pageErrors: [
    async ({ page, allowedErrors }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      // CSP 違反は console に出ない場合もあるので、イベントでも拾う
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await use(errors);
      expect(errors.filter((e) => !allowedErrors.some((re) => re.test(e)))).toEqual([]);
    },
    { auto: true },
  ],
});

// 1x2 の縦長 PNG
export const tinyPortraitPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR4nGNgYGD4z8DAAAAEAAH6Lc3/AAAAAElFTkSuQmCC',
  'base64',
);

// フォルダ選択ダイアログと書き込み許可のダイアログは OS の画面なので自動操作できない。
// そこで showDirectoryPicker を差し替え、ブラウザ内のストレージ（OPFS）に作ったフォルダを返す。
// OPFS のハンドルは実際のフォルダと同じ API で動き、許可は最初から付いている。

// TypeScript の DOM の型にはまだ入っていない
declare global {
  interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    putImage: (path: string, n: number, w?: number, h?: number) => Promise<void>;
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

      // テスト用フォルダ（photos）に画像を書き込む。n で色を変える
      window.putImage = async (path, n, w = 400, h = 600) => {
        const parts = path.split('/');
        let parent = await (await navigator.storage.getDirectory()).getDirectoryHandle('photos', { create: true });
        for (const p of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(p, { create: true });
        const canvas = new OffscreenCanvas(w, h);
        const g = canvas.getContext('2d')!;
        g.fillStyle = `hsl(${n * 47} 60% 45%)`;
        g.fillRect(0, 0, w, h);
        // スクリーンショットで、どの画像がどこに・どう切り抜かれて出ているか分かるよう、枠とファイル名を描く
        g.strokeStyle = '#fff';
        g.lineWidth = Math.min(w, h) / 40;
        g.strokeRect(0, 0, w, h);
        g.fillStyle = '#fff';
        g.font = `bold ${Math.min(w, h) / 6}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(parts.at(-1)!.replace(/\.png$/, ''), w / 2, h / 2);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const file = await (await parent.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
        await file.write(blob);
        await file.close();
      };

      window.showDirectoryPicker = async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('photos', { recursive: true }).catch(() => {});
        const dir = await root.getDirectoryHandle('photos', { create: true });
        for (const [n, { path, w, h }] of images.entries()) await window.putImage(path, n, w, h);
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

// 開いた後のテスト用フォルダに画像を足す（外から追加された状態を作る）
export function addImages(page: Page, paths: string[]) {
  return page.evaluate(async (paths) => {
    for (const [n, path] of paths.entries()) await window.putImage(path, 100 + n);
  }, paths);
}

// 開いた後のテスト用フォルダからファイルを消す（外から削除された状態を作る）
export function removeFiles(page: Page, paths: string[]) {
  return page.evaluate(async (paths) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('photos');
    for (const path of paths) await dir.removeEntry(path);
  }, paths);
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
