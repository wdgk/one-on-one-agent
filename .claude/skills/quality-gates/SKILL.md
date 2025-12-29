---
name: quality-gates
description: 調査成果物の品質ゲート。鮮度、矛盾、根拠不足、反証不足、カバレッジ不足を検出し、最小の追加調査で埋める指示を作る。
---

# Quality Gates（品質チェック）

## チェック観点（必須）
1) Evidence density：断定に [S#] が付いているか／Hypothesisが明示されているか
2) Freshness：期間制約に合うか（古い場合はFoundational等のラベルがあるか）
3) Contradictions：ソース間の食い違いを放置していないか
4) Coverage：Research Questions の8〜12が埋まっているか（穴がどこか明確か）
5) Counterpoints：反証/リスクが1本以上含まれ、内容にも反映されているか
6) Scope alignment：地域・対象・サンプルのズレを理解して書いているか

## 出力ルール
- 指摘は具体的（見出し名/問題文/理由）
- 追加調査は最大1ループ想定、最大5アクションまで
- 追加検索クエリ（JP3/EN3）を必ず出す
