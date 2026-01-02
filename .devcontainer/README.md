# Dev Container設定

このディレクトリには、Visual Studio CodeのDev Container（開発コンテナ）設定が含まれています。

## 概要

Dev Containerを使用することで、Windows、Mac、Linuxなど、どの環境でも一貫した開発環境を簡単にセットアップできます。

## 含まれる機能

### 開発環境
- **Node.js 20**: プロジェクトで要求される最小バージョン
- **TypeScript**: 最新のTypeScriptサポート
- **C/C++ビルドツール**: `better-sqlite3`のネイティブビルドに必要
- **Git**: バージョン管理
- **Zsh + Oh My Zsh**: より使いやすいシェル環境

### VS Code拡張機能（自動インストール）
- **ESLint**: コード品質チェック
- **Prettier**: コード整形
- **TypeScript**: TypeScript言語サポート
- **Code Spell Checker**: スペルチェック
- **Markdown All in One**: Markdownサポート
- **Markdown Mermaid**: Mermaid図のプレビュー
- **Docker**: Docker関連のサポート

### 自動セットアップ
- 依存関係の自動インストール (`npm install`)
- プロジェクトの自動ビルド (`npm run build`)
- Claude CodeとCodexのインストール
- AWS認証情報の自動マウント（`~/.aws`ディレクトリ）
- Claude/Codex設定の自動マウント（`~/.claude`、`~/.codex`ディレクトリ）

## 使い方

### 初回セットアップ

1. 必要なソフトウェアをインストール:
   - [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - [Visual Studio Code](https://code.visualstudio.com/)
   - [Dev Containers拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. リポジトリをクローン:
   ```bash
   git clone https://github.com/wdgk/one-on-one-agent.git
   cd one-on-one-agent
   ```

3. VS Codeでプロジェクトを開く:
   ```bash
   code .
   ```

4. コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開き、「Dev Containers: Reopen in Container」を選択

5. 初回起動時は、Dockerイメージのダウンロードと依存関係のインストールに数分かかります

### 環境変数の設定

Dev Container内でも `.env` ファイルが必要です:

```bash
# コンテナ内で実行
cp .env.example .env
# エディタで.envファイルを編集
```

### AWS認証情報

ホスト環境で以下のいずれかの方法でAWS認証情報を設定してください:

#### 方法1: AWS CLIを使用
```bash
# ホスト環境で実行
aws configure
```

#### 方法2: 手動で設定
`~/.aws/credentials` ファイルを作成:
```ini
[default]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
```

Dev Containerは自動的にホストの `~/.aws` ディレクトリ（`$HOME/.aws`）をマウントするため、コンテナ内から認証情報を利用できます。

**Windows環境での注意**:
- Git Bash、PowerShell、WSL2などのターミナルでは`HOME`環境変数が自動設定されます
- WindowsネイティブのコマンドプロンプトからDev Containerを起動する場合:
  - システム環境変数`HOME`を`%USERPROFILE%`に設定
  - または、`devcontainer.json`の`mounts`を`${localEnv:USERPROFILE}/.aws`に変更

### Google Calendar認証情報

Google Calendar APIを使用する場合:

1. [Google Cloud Console](https://console.cloud.google.com/)でOAuth 2.0認証情報を作成
2. `credentials.json` をプロジェクトルートに配置
3. 初回実行時に認証フローが開始され、`token.json` が生成されます

### Claude CodeとCodexの設定

Dev Containerは、ホスト側のClaude/Codex設定を自動的に利用できるようにします。

#### 自動インストールと設定マウント
- **Claude Code** (`@anthropic-ai/claude-code`): コンテナ起動時に自動インストール
- **Codex** (`@openai/codex`): コンテナ起動時に自動インストール
- ホストの`~/.claude`と`~/.codex`が自動的にマウントされ、認証情報や設定が共有されます

#### 初回セットアップ
ホスト側でClaudeCodeまたはCodexを未設定の場合:

```bash
# コンテナ内で実行
claude auth login
codex auth login
```

設定はホストの`~/.claude`と`~/.codex`に保存されるため、ホスト側でも同じ設定が利用できます。

#### 動作確認
```bash
# コンテナ内で実行
claude --version
codex --version

# Codexレビュー実行（CLAUDE.mdで推奨）
codex review --uncommitted
```

**Windows環境での注意**:
- Claude/Codexの設定ディレクトリもAWSと同様、`$HOME/.claude`と`$HOME/.codex`を使用します
- WindowsネイティブのコマンドプロンプトでDev Containerを起動する場合は、`HOME`環境変数の設定が必要です

## トラブルシューティング

### better-sqlite3のビルドエラー

Dev Containerには必要なC/C++ビルドツールが含まれているため、通常はエラーは発生しません。エラーが発生した場合:

```bash
# コンテナ内で実行
npm rebuild better-sqlite3
```

### ポート競合

Dev Containerはデフォルトでポートをフォワードしません。必要に応じて `devcontainer.json` の `forwardPorts` を設定してください。

### キャッシュのクリア

依存関係の問題が発生した場合:

```bash
# コンテナ内で実行
rm -rf node_modules
npm install
```

または、Dev Containerを再ビルド:
- コマンドパレット → "Dev Containers: Rebuild Container"

## カスタマイズ

### 追加の拡張機能をインストール

`devcontainer.json` の `customizations.vscode.extensions` に拡張機能のIDを追加:

```json
{
  "customizations": {
    "vscode": {
      "extensions": [
        "existing.extension",
        "your.new-extension"
      ]
    }
  }
}
```

### 追加のパッケージをインストール

Dockerイメージに追加パッケージが必要な場合、`postCreateCommand` を編集:

```json
{
  "postCreateCommand": "sudo apt-get update && sudo apt-get install -y your-package && npm install && npm run build"
}
```

### 環境変数の追加

`remoteEnv` セクションに環境変数を追加:

```json
{
  "remoteEnv": {
    "NODE_ENV": "development",
    "YOUR_VAR": "your_value"
  }
}
```

## 参考資料

- [Dev Containers公式ドキュメント](https://code.visualstudio.com/docs/devcontainers/containers)
- [devcontainer.json リファレンス](https://containers.dev/implementors/json_reference/)
- [Dev Containers Specification](https://containers.dev/)
