---
name: deliverable-spec
description: Evidence notesから成果物を生成するための汎用テンプレ集。variantで切り替える（社内メモ、比較表、意思決定、行動規範、1枚サマリ等）。
---

# Deliverable Spec（成果物テンプレ）

## 共通ルール
- 重要主張は [S#] を付ける。付けられないものは Hypothesis と明示。
- 「分かっている / 分かっていない / 次の一手」を必ず含める。
- 表が有効なら表にする（比較・手順・責任分界など）。

## Variants

### 1) internal_memo（社内メモ）
- TL;DR（5〜10行）
- Key findings（[S#]付き）
- Implications（示唆）
- Risks / Counterpoints
- Unknowns
- Next steps
- Sources map（[S#]一覧）

### 2) comparison_table（比較表）
- TL;DR（推奨案 + トレードオフ）
- 比較軸の定義
- 比較表（Option × Axis）
- リスクと前提
- 次に必要な検証
- Sources map

### 3) decision_record（意思決定用：ADR/ODR風）
- Context / Problem
- Options considered
- Decision（仮決定でも可）
- Rationale（根拠 [S#]）
- Risks / Counterpoints
- Consequences / Follow-ups
- Sources map

### 4) behavior_spec（行動規範）
- TL;DR
- What we know（観察：各行に [S#]）
- Org/Operating model summary（必要なら）
- Engineer 行動規範：原則 / Do&Don’t / レベル別期待 / BARS
- EM 行動規範：原則 / 具体行動（設計・評価・採用・育成・ガバナンス）/ レベル別 / BARS
- 90日導入プラン（実験3〜5、指標、リスク）
- Unknowns / Next research
- Sources map

### 5) exec_onepager（上層向け1枚）
- One-line thesis
- 3 bullets of evidence-backed facts
- Decision options（2〜3）
- Recommendation（条件付きで）
- Risks / What could go wrong
- Next 2 weeks plan
- Sources map
