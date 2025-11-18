# 1on1 Agenda Generation Agent

Backlogの活動データから1on1アジェンダを自動生成するCLIツール。

## 特徴

- Backlog課題・PRの自動収集（MCP経由）
- Claude AIによる構造化アジェンダ生成
- 自然言語での指示に対応
- Markdown形式での出力

## 必須要件

- Node.js 20.0.0以上
- Backlog APIキー
- Anthropic APIキー

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定

# ビルド
npm run build

# グローバルコマンドとして使用する場合（オプション）
npm link
```

## 使い方

### 基本的な使い方

```bash
# npm経由
npm run agenda "佐藤さんの直近2週間の1on1アジェンダを作成して"

# グローバルコマンド（npm link後）
agenda "佐藤さんの直近2週間"
```

### 入力例

```bash
# 2週間分のアジェンダ
npm run agenda "佐藤さんの直近2週間"

# 1ヶ月分のアジェンダ
npm run agenda "田中さんの過去1ヶ月"

# 英語名での指定
npm run agenda "Taro Yamadaさんの１ヶ月の活動をまとめて"
```

**注意**: Backlogでユーザーが英語名で登録されている場合、英語名で指定してください。

### 出力

生成されたアジェンダは`output/`ディレクトリに保存されます：

```text
output/agenda_佐藤太郎_2024-11-15.md
```

アジェンダには以下のセクションが含まれます：

- 最近のハイライト（成果）
- 気になる点・リスク
- チームとのコラボレーション
- 成長・学習・キャリア
- 1on1での質問案
- メモ欄

## 開発

```bash
# テスト
npm test

# テスト（1回だけ実行）
npm run test:run

# ビルド（watch）
npm run dev
```

## ライセンス

MIT
