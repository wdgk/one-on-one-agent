---
name: research-pipeline
description: 汎用の調査パイプライン。論点分解→検索→最大Nソース選定→Sourcepack→根拠抽出→統合→品質ゲート→（必要なら）追加1ループ。
# allowed-tools: [Read, Grep, Glob, Bash, <SEARCH_TOOL>, <FETCH_TOOL>]
---

# Research Pipeline（汎用）

## 入力（最小）
- Topic（必須）
- Constraints（任意）：地域/期間/業界/規模/対象読者/最大ソース数/鮮度優先期間 など
- Output variant（任意）：internal_memo / comparison_table / behavior_spec / decision_record / exec_onepager
- Pack（任意）：論点セット名（例：ai_org）

## デフォルト制約（上書き可）
- max_sources: 10
- freshness_prefer: 18か月以内（基礎理論は例外として Foundational 扱い）
- JP+EN検索：それぞれ3クエリ以上
- counterpoint: 反証/リスク系を最低1本
- 多様性：研究/公式/調査会社/実務事例を可能な範囲で混ぜる

## 進め方（骨格）
1) 論点分解（8〜12のResearch Questions）
2) 検索→最大Nにキュレーション→Sourcepack（[S1..]）
3) 根拠抽出（evidence-notesのテンプレ厳守）
4) 統合（deliverable-specのvariantテンプレに沿う）
5) 品質ゲート（quality-gates）
6) 追加調査は最大1ループ（ギャップ埋めに限定）

## 出力の鉄則
- 重要主張は [S#] を付ける。無理なら Hypothesis。
- What we know / What we don’t know / Next steps を分離。
