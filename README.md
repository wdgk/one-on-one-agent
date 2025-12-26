# 1on1 Agenda Generation Agent

Backlogの活動データから1on1アジェンダを自動生成するCLIツール。

## 特徴

- Backlog課題・PRの自動収集（MCP経由）
- AWS Bedrock経由でClaude AIによる構造化アジェンダ生成
- 自然言語での指示に対応
- Markdown形式での出力

## 必須要件

- Node.js 20.0.0以上
- Backlog APIキー
- AWS認証情報（Bedrock利用）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/wdgk/one-on-one-agent.git
cd one-on-one-agent
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env`ファイルを作成し、必要な設定を行います：

```bash
cp .env.example .env
```

`.env`ファイルを編集して以下を設定：

#### Backlog設定（必須）

```env
BACKLOG_DOMAIN=your-space.backlog.com
BACKLOG_API_KEY=your-backlog-api-key
```

- **BACKLOG_DOMAIN**: BacklogのスペースURL（例: `example.backlog.com`）
- **BACKLOG_API_KEY**: Backlog > 個人設定 > API から取得

#### AWS Bedrock設定（必須）

```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

- **AWS_REGION**: 使用するAWSリージョン（デフォルト: `us-east-1`）
- **BEDROCK_MODEL_ID**: 使用するモデルID（デフォルト: Claude 3.5 Sonnet v2）

#### AWS認証情報の設定

以下のいずれかの方法で設定してください：

1. **環境変数**:
   ```env
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   AWS_SESSION_TOKEN=your-session-token  # 一時認証情報の場合のみ
   ```

2. **AWS credentials ファイル** (`~/.aws/credentials`):
   ```ini
   [default]
   aws_access_key_id = your-access-key-id
   aws_secret_access_key = your-secret-access-key
   ```

3. **IAM Role**: EC2/ECS/Lambda上で実行する場合は自動取得

#### Slack統合（オプション）

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
```

### 4. ビルド

```bash
npm run build
```

### 5. グローバルコマンドとして使用する場合（オプション）

```bash
npm link
```

これにより、`npm run agenda`の代わりに`agenda`コマンドが使えるようになります。

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

## バッチ処理

複数メンバーのアジェンダを一括生成できます。

### 1. 設定ファイルの作成

`agenda-config.yaml`を作成します：

```yaml
# メンバーリスト
members:
  - name: 佐藤太郎
    period:
      weeks: 2  # 2週間分

  - name: 田中花子
    period:
      months: 1  # 1ヶ月分

  - name: 山田一郎
    period:
      days: 7  # 7日分

  - name: 鈴木次郎
    # 期間指定なし = デフォルト2週間

# オプション設定
options:
  maxConcurrency: 3      # 最大並列実行数
  continueOnError: true  # エラー時も続行
  outputDir: output      # 出力ディレクトリ
```

**注意**:
- `weeks`, `months`, `days`のうち1つだけ指定してください
- Backlogでユーザーが英語名で登録されている場合、英語名で指定してください

### 2. バッチ実行

```bash
# デフォルト設定ファイル（agenda-config.yaml）で実行
npm run agenda:batch

# カスタム設定ファイルを指定
npm run agenda:batch -- --config custom-config.yaml

# ドライラン（実際には生成しない）
npm run agenda:batch -- --dry-run

# 詳細出力
npm run agenda:batch -- --verbose
```

### 3. コマンドラインオプション

| オプション | 短縮形 | 説明 |
|----------|--------|------|
| `--config <path>` | `-c` | 設定ファイルのパス（デフォルト: `agenda-config.yaml`） |
| `--dry-run` | `-d` | ドライラン（実際の生成は行わない） |
| `--verbose` | `-v` | 詳細出力を有効化 |
| `--help` | `-h` | ヘルプを表示 |

### 4. 出力

バッチ実行時の出力は以下のようになります：

```text
output/
  batch_20241115_143022/
    agenda_佐藤太郎_2024-11-15.md
    agenda_田中花子_2024-11-15.md
    agenda_山田一郎_2024-11-15.md
    summary.md  # 実行結果のサマリー
```

`summary.md`には以下の情報が含まれます：
- 生成日時
- 総メンバー数、成功数、失敗数
- 成功したメンバー一覧（処理時間付き）
- 失敗したメンバー一覧（エラー内容付き）
- 統計情報（平均処理時間、総処理時間）

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
