# Triptych Slideshow

縦長の画像を3枚横並びで全画面表示するスライドショー。https://triptych.komori.dev

- 画像はブラウザ内で読み込むだけで、外部には送信しない
- フォルダをドロップするか「フォルダを選択」で読み込む
- `E` で編集モード（画像の選別）。`←` `→` で選んで `D` で削除候補にし、`X` で確認してまとめて削除（「フォルダを選択」で開いたときのみ。ゴミ箱には入らない）
- `H` でキー操作一覧

## 開発

```sh
pnpm install
pnpm dev     # ローカルで起動
pnpm test    # Playwright のテスト（初回は pnpm exec playwright install chromium）
pnpm lint    # ESLint（index.html の <script> も対象）
pnpm format  # Prettier で整形
pnpm deploy  # Cloudflare Workers にデプロイ
```

コミット時に lefthook が lint・整形・型チェック・テストを実行する（`pnpm install` でフックが入る）。

ページ本体は `public/index.html` の1ファイルのみ。
