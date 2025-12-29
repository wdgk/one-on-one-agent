---
name: evidence-notes
description: 汎用の根拠抽出フォーマット。意見禁止。日付・スコープ・注意点・数値を必ず残し、[S#]で参照できる形にする。
# allowed-tools: [Read, Grep, Glob, Bash, <FETCH_TOOL>]
---

# Evidence Notes（証拠メモ）仕様

## 原則
- 意見・結論・推測は禁止
- ソースに書いてないことを補完しない
- 引用は最小限（短く）。基本は要約。

## テンプレ（1ソースにつき必ずこれ）
## [S#] <Title>
- URL:
- Date (published/updated):
- Type (paper / official / consulting / case / other):
- Scope (region, segment, timeframe, sample):
- Facts (max 7):
  - ...
- Numbers:
  - ...
- Definitions/Assumptions:
  - ...
- Caveats/Bias:
  - ...
- Where in source (section/heading hint):
  - ...

## 追加ルール
- Date/Scope が不明なら Unknown と書く（空欄禁止）
- Facts は最大7つ（長文のコピペ禁止）
