# CLAUDE.md

ページ本体は `public/index.html` の1ファイルのみ（ビルドなし）。

## 動作確認

- コミット時に lefthook（`lefthook.yml`）が lint・整形・型チェック・テストを実行する。フックを `--no-verify` で飛ばさない
- コミットしていない変更があるまま作業を終えようとすると、Stop hook（`.claude/hooks/verify-on-stop.sh`）が同じ検証を実行し、失敗したら作業を続けさせる
- `pnpm test` で Playwright のテストを実行する（`wrangler dev` は自動で起動する）
- 変更したらテストを実行し、新しい挙動にはテストを追加する
- フォルダ選択と書き込み許可のダイアログは自動操作できないので、テストでは `showDirectoryPicker` を差し替えて OPFS のフォルダを返している（`tests/helpers.ts` の `setup`）
- 実際のディスク上のファイルや Chrome の許可ダイアログが関わる変更は、`pnpm dev` で開いて手でも確認するようユーザーに伝える
