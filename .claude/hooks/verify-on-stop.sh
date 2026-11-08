#!/usr/bin/env bash
# Claude が作業を終える前に lint・整形チェック・型チェック・テストを実行し、失敗したら作業を続けさせる。
# - コミットしていない変更がなければ何もしない（質問に答えただけの回など）
# - 前回成功したときから変更がなければ実行し直さない
# - 失敗のあと何も直さずにもう一度終えようとしたら、ループしないよう止めずにユーザーへ知らせる
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

input=$(cat)
active=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).stop_hook_active===true)}catch{console.log(false)}})')

[ -z "$(git status --porcelain)" ] && exit 0

# 作業ツリーの状態（変更差分と、追跡していないファイルの中身）のハッシュ
state=$({
  git diff HEAD --binary
  git ls-files --others --exclude-standard -z | xargs -0 shasum 2>/dev/null
} | shasum | cut -d' ' -f1)
ok_file=$(git rev-parse --git-path claude-verify-ok)
ng_file=$(git rev-parse --git-path claude-verify-ng)

[ "$(cat "$ok_file" 2>/dev/null)" = "$state" ] && exit 0
if [ "$active" = true ] && [ "$(cat "$ng_file" 2>/dev/null)" = "$state" ]; then
  node -e 'console.log(JSON.stringify({systemMessage: "検証が失敗したままです（Stop hook）。変更がないので止めずに終了します"}))'
  exit 0
fi

out=$({ pnpm lint && pnpm typecheck && pnpm exec prettier --check . && pnpm test; } 2>&1)
if [ $? -eq 0 ]; then
  printf '%s' "$state" >"$ok_file"
  exit 0
fi

printf '%s' "$state" >"$ng_file"
printf '%s' "$out" | tail -n 60 | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  console.log(JSON.stringify({
    decision: "block",
    reason: "lint・整形チェック・型チェック・テストのどれかが失敗しました。直してから終えてください（整形は pnpm format）。\n\n" + s,
  }));
});'
exit 0
