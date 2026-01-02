# 1on1 Agenda Generation Agent

Backlogの活動データから1on1アジェンダを自動生成するCLIツール。

## 特徴

### 対話型アジェンダ生成（`agenda`コマンド）
- Backlog課題・PRの自動収集（MCP経由）
- AWS Bedrock経由でClaude AIによる構造化アジェンダ生成
- 自然言語での指示に対応
- Markdown形式での出力

### ゼロタッチ配信（`ambient`コマンド）
- Google Calendarから1on1イベントを自動抽出
- Slack/Backlog/Calendarから関連情報を自動収集
- アジェンダを自動生成してSlack DMに配信
- 完全自動化によるゼロタッチ運用

## 必須要件

- Node.js 20.0.0以上
- Backlog APIキー
- AWS認証情報（Bedrock利用）
- C/C++コンパイラ（`better-sqlite3`のネイティブビルドに必要）
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Ubuntu/Debian: `build-essential`
  - Windows: Visual Studio Build Tools

## Dev Container（推奨）

VS CodeとDockerがインストールされている環境では、Dev Containerを使用することで環境構築を大幅に簡略化できます。

### 必要なもの
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Dev Containers拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### 使い方

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/wdgk/one-on-one-agent.git
   cd one-on-one-agent
   ```

2. VS Codeでフォルダを開く:
   ```bash
   code .
   ```

3. VS Codeで「Reopen in Container」を選択（または `Cmd+Shift+P` → "Dev Containers: Reopen in Container"）

Dev Containerが起動すると、以下が自動で設定されます:
- Node.js 20
- TypeScript
- C/C++ビルドツール（better-sqlite3用）
- 推奨VS Code拡張機能
- 依存関係のインストール

### AWS認証情報の設定

Dev Containerはホストの `~/.aws` ディレクトリを自動的にマウントします（`$HOME/.aws`を使用）。ホスト側で以下のいずれかの方法でAWS認証情報を設定してください:

1. `aws configure` コマンドで設定
2. `~/.aws/credentials` ファイルを手動で作成

**Windows環境での注意**:
- Git Bash、PowerShell、WSL2などのターミナルを使用している場合、`HOME`環境変数が自動的に設定されます
- WindowsネイティブのコマンドプロンプトでDev Containerを起動する場合は、以下のいずれかを実施してください:
  - システム環境変数`HOME`を`%USERPROFILE%`に設定
  - または、`.devcontainer/devcontainer.json`の`mounts`セクションを`${localEnv:USERPROFILE}/.aws`に変更

### 環境変数の設定

Dev Container内でも `.env` ファイルが必要です。以下の手順で設定してください:

```bash
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定
```

### Claude CodeとCodexの設定

Dev Containerは自動的にClaudeCodeとCodexをインストールし、ホスト側の設定を利用できるようにします:

- **自動インストール**: `@anthropic-ai/claude-code`と`@openai/codex`が自動的にインストールされます
- **設定の共有**: ホストの`~/.claude`と`~/.codex`ディレクトリがマウントされ、認証情報や設定がそのまま利用できます

**初回セットアップが必要な場合**:
ホスト側でClaudeCodeまたはCodexを未設定の場合は、Dev Container起動後にコンテナ内で初回設定を行ってください:

```bash
# Claude Codeの初期設定
claude auth login

# Codexの初期設定
codex auth login
```

設定はホストの`~/.claude`と`~/.codex`に保存されるため、次回以降は自動的に利用できます。

## セットアップ（ローカル環境）

Dev Containerを使用しない場合は、以下の手順でローカル環境をセットアップしてください。

### 1. リポジトリのクローン

```bash
git clone https://github.com/wdgk/one-on-one-agent.git
cd one-on-one-agent
```

### 2. 依存関係のインストール

```bash
npm install
```

**注意**: `better-sqlite3`はネイティブモジュールのため、初回インストール時にC/C++コンパイラによるビルドが実行されます。環境によってはビルドに数分かかる場合があります。

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
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

- **AWS_REGION**: 使用するAWSリージョン（デフォルト: `us-east-1`）
- **BEDROCK_MODEL_ID**: 使用するモデルID（デフォルト: Claude Sonnet 4.5）

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

#### Google Calendar設定（Ambient Agentで必須）

```env
GOOGLE_CALENDAR_CREDENTIALS_PATH=/path/to/credentials.json
GOOGLE_CALENDAR_TOKEN_PATH=/path/to/token.json
```

- **GOOGLE_CALENDAR_CREDENTIALS_PATH**: Google Cloud ConsoleからダウンロードしたOAuth 2.0認証情報ファイルのパス
- **GOOGLE_CALENDAR_TOKEN_PATH**: 認証トークンを保存するファイルのパス（初回実行時に自動生成）

Google Calendar APIの設定方法は[Google Calendar API Quickstart](https://developers.google.com/calendar/api/quickstart/nodejs)を参照してください。

#### Slack統合（Ambient Agentでオプション）

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
```

- **SLACK_BOT_TOKEN**: Slack App > OAuth & Permissions > Bot User OAuth Token
- **SLACK_USER_TOKEN**: Slack App > OAuth & Permissions > User OAuth Token

#### Ambient Agent設定（オプション）

```env
# データベースパス（デフォルト: ./ambient.db）
AMBIENT_DB_PATH=/path/to/ambient.db

# 1on1カレンダーの先読み時間（デフォルト: 168時間 = 7日）
AMBIENT_LOOKAHEAD_HOURS=168

# 社内ドメイン（この文字列を含むメールアドレスを社内として認識）
AMBIENT_INTERNAL_DOMAIN=@example.com

# 自分のメールアドレス（Calendarから1on1を抽出する際に使用）
AMBIENT_MY_EMAIL=your-email@example.com
```

### 4. ビルド

```bash
npm run build
```

### 5. グローバルコマンドとして使用する場合（オプション）

```bash
npm link
```

これにより、以下のコマンドが使えるようになります：
- `agenda`: 対話型アジェンダ生成
- `ambient`: ゼロタッチ配信

## 使い方

## 対話型アジェンダ生成（`agenda`コマンド）

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

## ゼロタッチ配信（`ambient`コマンド）

Ambient Agentは、Google Calendarから1on1イベントを自動抽出し、関連情報を収集してアジェンダを生成・配信する完全自動化ツールです。

### 基本的な使い方

```bash
# カレンダーから1on1を抽出してJobを作成
ambient run

# アジェンダを自動生成
ambient run --generate-agenda

# アジェンダを生成してSlack DMに配信
ambient run --generate-agenda --deliver

# 先読み時間を指定（デフォルト: 168時間 = 7日）
ambient run --lookahead 48h --generate-agenda --deliver
```

### コマンドオプション

| オプション | 短縮形 | 説明 |
|----------|--------|------|
| `--lookahead <hours>` | - | 先読み時間（例: `48h`）。デフォルトは環境変数`AMBIENT_LOOKAHEAD_HOURS`または168時間 |
| `--dry-run` | `-d` | ドライラン（Jobの作成のみ） |
| `--generate-agenda` | `-g` | アジェンダを自動生成 |
| `--deliver` | - | アジェンダをSlack DMに配信（`-g`と併用） |

### 動作フロー

1. **Job抽出**: Google Calendarから指定期間内の1on1イベントを抽出
2. **情報収集**: 各1on1参加者について以下を自動収集：
   - Slack: 直近のDM履歴
   - Backlog: 担当課題・PR・コメント
   - Calendar: 今後の予定
3. **アジェンダ生成**: 収集した情報からAIがアジェンダを生成
4. **配信**: 生成したアジェンダをSlack DMに送信（`--deliver`指定時）

### Job状態管理

Ambient Agentは各1on1をJobとして管理し、以下の状態遷移を行います：

```
PENDING → COLLECTING → DRAFTED → SENT_PREVIEW → APPROVED → DISPATCHED
                      ↓
                    FAILED
```

- **PENDING**: Job作成済み（未処理）
- **COLLECTING**: 情報収集中
- **DRAFTED**: アジェンダ生成完了
- **SENT_PREVIEW**: Slack DMにプレビュー送信済み
- **APPROVED**: 承認済み（将来実装予定）
- **DISPATCHED**: 確定版配信済み（将来実装予定）
- **FAILED**: エラー発生

### 使用例

```bash
# 明日の1on1のアジェンダを生成して配信
ambient run --lookahead 24h --generate-agenda --deliver

# 今週の1on1をスケジュール（配信はしない）
ambient run --lookahead 168h --generate-agenda

# ドライラン（何も実行しない）
ambient run --dry-run
```

### 注意事項

- `--deliver`オプションはSlack設定が必要です
- Slack設定がない場合、警告が表示され配信はスキップされます
- 同じJobに対して複数回実行しても冪等性が保証されます（重複配信されません）

## バッチ処理（`agenda`コマンド）

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
