# Triptych Slideshow

縦長の画像を3枚横並びで全画面表示するスライドショー。https://triptych.komori.dev

- 画像はブラウザ内で読み込むだけで、外部には送信しない
- フォルダをドロップするか「フォルダを選択」で読み込む
- `H` でキー操作一覧

## 開発

```sh
pnpm install
pnpm dev     # ローカルで起動
pnpm deploy  # Cloudflare Workers にデプロイ
```

ページ本体は `public/index.html` の1ファイルのみ。
