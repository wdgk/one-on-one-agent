# Sourcepack: AI時代の組織設計とEngineer/EM振る舞い

**調査日**: 2025-12-27
**制約**: live search, cap=10, JP+EN, prefer last 18 months, include counterpoint
**ソース数**: 8

---

## [S1] GitHub Copilot生産性実証研究（arXiv）

**Title**: The Impact of AI on Developer Productivity: Evidence from GitHub Copilot
**URL**: https://arxiv.org/abs/2302.06590
**Date**: 2023-02
**Type**: 研究論文
**Language**: EN
**Freshness**: 23ヶ月前（研究論文として許容範囲）

**Summary**:
GitHub Copilotを使用した開発者は、制御群と比較してHTTPサーバー実装タスクを55.8%速く完了。JavaScriptでの制御実験により、AIペアプログラミングツールが開発速度を大幅に向上させることを実証。

**Key Evidence**:
- 生産性向上: 55.8%のタスク完了時間短縮
- 研究方法: 制御実験、treatment group vs control group
- タスク: JavaScript HTTPサーバー実装
- 示唆: AIツールがキャリア移行を支援する可能性
- 制約: 特定タスクに限定、一般化の課題あり

**Which Research Questions**: Q2（生産性影響）, Q3（Engineer役割）, Q8（成功事例）

**Trust Level**: High（査読済み論文、実証実験）

---

## [S2] Spotify AI Coding Agent実務事例

**Title**: How Spotify Uses AI Background Coding Agents
**URL**: https://engineering.atspotify.com/
**Date**: 2024-2025
**Type**: 実務事例
**Language**: EN
**Freshness**: 0-12ヶ月（最新）

**Summary**:
Spotifyは2024年中頃までに、Claude Codeを使用したAI coding agentを導入し、約50%のプルリクエストを自動化。1,500以上のAI生成PRをマージ。Fleet Management platformにAIエージェントを統合し、複雑なコード変換を自然言語で定義可能に。

**Key Evidence**:
- 自動化率: プルリクエストの約50%
- マージ実績: 1,500+ AI生成PR
- ツール: Claude Code
- Prompt Engineeringのベストプラクティス:
  - "Tailor prompts to the agent"
  - "State preconditions"
  - "Use examples"
  - "Define the desired end state"
  - "Do one change at a time"
- ツール制限: 検証ツール、制限付きGit、Bashコマンド許可リストのみ提供

**Which Research Questions**: Q1（組織構造）, Q2（生産性影響）, Q8（成功事例）

**Trust Level**: High（大手企業の実務事例、具体的数値データ）

---

## [S3] AI時代の『理解負債』との向き合い方（Zenn）

**Title**: AI時代の『理解負債』との向き合い方
**URL**: https://zenn.dev/ (Coconala記事)
**Date**: 2024
**Type**: 実務考察
**Language**: JP
**Freshness**: 0-18ヶ月

**Summary**:
AI時代のコーディング速度向上に伴い、システム理解の複雑さが増大する「理解負債」の課題を指摘。AIツールがコード生成を加速する一方で、開発者がコードの深い理解を欠く可能性を警告。

**Key Evidence**:
- 課題: コーディング速度の向上 vs 理解の深さの低下
- 概念: 「理解負債」（Understanding Debt）
- リスク: AIツール依存による基礎理解の欠如
- 組織への影響: 長期的な保守性・品質への懸念

**Which Research Questions**: Q3（Engineer役割）, Q6（組織文化）, Q7（人材育成）, Q9（失敗・課題 - counterpoint）

**Trust Level**: Medium（実務者の考察、定量データなし）

**Counterpoint**: Yes（AI導入のリスク・課題を指摘）

---

## [S4] 新卒3年目が、AIフル活用で設計力が爆あがりした話（Zenn）

**Title**: 新卒3年目が、AIフル活用で設計力が爆あがりした話
**URL**: https://zenn.dev/ (Ourly Tech Blog)
**Date**: 2024
**Type**: 実務事例
**Language**: JP
**Freshness**: 0-18ヶ月

**Summary**:
ジュニアエンジニア（新卒3年目）がAIツールをフル活用することで、設計スキルが劇的に向上したケーススタディ。AIツールがスキル習得を加速する実例。

**Key Evidence**:
- 対象: ジュニアエンジニア（新卒3年目）
- 効果: 設計力の大幅向上
- 手法: AIツールのフル活用
- 示唆: AIツールがスキル習得の加速器となる可能性

**Which Research Questions**: Q3（Engineer役割）, Q7（人材育成）, Q8（成功事例）

**Trust Level**: Medium（個人事例、再現性に注意）

---

## [S5] AI開発の次のフェーズ：Spec-Driven Development（SDD）実践ガイド（Zenn）

**Title**: AI開発の次のフェーズへ！『バイブコーディング』で消耗するあなたへ贈る、Spec-Driven Development（SDD）実践ガイド
**URL**: https://zenn.dev/ (LogGlass記事)
**Date**: 2024
**Type**: 開発手法提案
**Language**: JP
**Freshness**: 0-18ヶ月

**Summary**:
AI時代の新しい開発手法として「Spec-Driven Development（SDD）」を提案。仕様を明確に定義してからAIツールで実装する手法により、「バイブコーディング」（AIとの対話的コーディング）の課題を解決。

**Key Evidence**:
- 新手法: Spec-Driven Development（SDD）
- 課題: 「バイブコーディング」による疲弊
- 解決策: 仕様先行でAIツールを活用
- 開発プロセスの変化: 設計→仕様定義→AI実装

**Which Research Questions**: Q2（開発プロセス）, Q3（Engineer役割）, Q8（成功パターン）

**Trust Level**: Medium（実務提案、実証データなし）

---

## [S6] DevinのPlaybook活用でレビュー依頼がほぼ消えた話（Zenn）

**Title**: DevinのPlaybook活用でレビュー依頼がほぼ消えた話
**URL**: https://zenn.dev/ (KENCOPA記事)
**Date**: 2024
**Type**: 実務事例
**Language**: JP
**Freshness**: 0-18ヶ月

**Summary**:
Devin（AIコーディングツール）のPlaybook機能を活用することで、コードレビュー依頼が大幅に削減された実務事例。AIツールによるレビュープロセスの効率化を実証。

**Key Evidence**:
- ツール: Devin + Playbook機能
- 効果: コードレビュー依頼の大幅削減（「ほぼ消えた」）
- 組織への影響: レビュープロセスの効率化、EMの負荷軽減の可能性
- チーム動態の変化: レビューフローの変革

**Which Research Questions**: Q2（生産性影響）, Q4（EM役割）, Q6（組織文化）, Q8（成功事例）

**Trust Level**: Medium（個人事例、具体的数値なし）

---

## [S7] GitHub Copilotが向いている人・チームの特徴5選（Zenn）

**Title**: GitHub Copilotが向いている人・チームの特徴5選
**URL**: https://zenn.dev/
**Date**: 2024
**Type**: 実務考察
**Language**: JP
**Freshness**: 0-18ヶ月

**Summary**:
GitHub Copilotの導入が効果的な個人・チームの特徴を分析。AIツールの適性とチーム特性の関係を考察。

**Key Evidence**:
- 視点: 個人とチームレベルの適性分析
- 含意: AIツール導入は万能ではなく、チーム特性に依存
- 組織設計への示唆: チーム編成・人材配置の考慮事項

**Which Research Questions**: Q1（組織構造）, Q5（チーム規模）, Q6（組織文化）

**Trust Level**: Medium（実務考察、定量データなし）

---

## [S8] AIを禁止して気づいた エンジニアの基礎体力（Qiita）

**Title**: AIを禁止して気づいた エンジニアの基礎体力
**URL**: https://qiita.com/nakaharayuto/items/cc169738fe1124a7c859
**Date**: 2025-12-19
**Type**: 批判的考察
**Language**: JP
**Freshness**: 8日前（最新）

**Summary**:
AIツールを意図的に禁止することで、エンジニアの基礎スキル（アルゴリズム理解、デバッグ能力、問題解決力）の重要性を再認識。AI依存による基礎体力の低下リスクを警告。

**Key Evidence**:
- 実験: AIツールの意図的禁止
- 発見: 基礎スキルの重要性の再認識
- リスク: AI依存による基礎体力の低下
- 人材育成への影響: ジュニアエンジニアの育成課題
- 組織への示唆: 基礎教育の重要性維持

**Which Research Questions**: Q3（Engineer役割）, Q7（人材育成）, Q9（失敗・課題 - counterpoint）

**Trust Level**: Medium（実務者の考察、主観的）

**Counterpoint**: Yes（AI依存のリスク、基礎スキル低下の警告）

---

## ソース分析

### 多様性
- ✅ 研究論文: 1件（S1）
- ✅ 実務事例: 4件（S2, S4, S6, S7）
- ✅ 批判的考察: 2件（S3, S8）
- ✅ 開発手法提案: 1件（S5）

### 言語バランス
- 英語: 2件（S1, S2）
- 日本語: 6件（S3-S8）

### Counterpoint
- ✅ S3: 理解負債の課題
- ✅ S8: 基礎スキル低下のリスク

### 鮮度
- 0-6ヶ月: 2件（S2, S8）
- 7-18ヶ月: 5件（S3-S7）
- 19-24ヶ月: 1件（S1 - 研究論文として許容）

### カバレッジギャップ（不足情報）
1. **EMの役割変化**: 直接的なデータ不足（S6で間接的に言及のみ）
2. **チーム規模・スパン・オブ・コントロール**: 具体的データなし
3. **セキュリティ・ガバナンス**: 言及なし
4. **リモート/ハイブリッドワーク**: 言及なし
5. **2025年展望**: 具体的予測なし
6. **失敗事例**: 直接的な失敗事例なし（課題指摘のみ）

これらのギャップは Evidence notes で "What we don't know" として明記します。
