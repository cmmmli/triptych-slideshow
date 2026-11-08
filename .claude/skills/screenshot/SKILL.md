---
name: screenshot
description: Screenshot the slideshow's main screens with fixture images and look at them. Use after changing anything visible in public/index.html (CSS, layout, overlays, toasts, edit mode, the start screen), or when asked how a screen looks.
---

`pnpm shot` は `shots/shots.spec.ts` にある画面を、テスト用の画像（枠とファイル名入りの単色）で開き、`screenshots/<名前>.png` に保存する。合否は判定しないので、画像を自分で見て確かめる。

1. 見た目に関わる変更を始める前に `pnpm shot` を実行し、`screenshots/*.png` を `screenshots/before/` に移す。比べる元になる。
2. 変更したら `pnpm shot` を実行する。一部だけなら `pnpm shot -g <名前>`。
3. 変更が影響する画面の PNG をすべて Read で開き、`before/` と見比べる。意図した変化が出ているか、ほかの部分が崩れていないか（重なり・はみ出し・切り抜き・余白・文字の読みやすさ）を確かめる。影響する画面を一枚残らず見たら完了。
4. 新しい画面や状態を足したときは、`shots/shots.spec.ts` にその画面を撮るケースを足して、2〜3 を繰り返す。
5. 報告には、見た画面の名前と、そこで確かめたことを書く。この方法では見えないもの（実際の写真、1440x900 以外の画面サイズ、フルスクリーン、アニメーションの動き）が変更に関わるなら、`pnpm dev` で開いて確かめるようユーザーに伝える。
