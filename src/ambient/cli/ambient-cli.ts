#!/usr/bin/env node

import 'dotenv/config';
import { loadAmbientConfig } from '../../config/ambient-config.js';
import { runCommand } from './commands/run.js';
import { closeGlobalDatabaseConnection } from '../storage/database.js';

/**
 * Ambient Agent CLIエントリーポイント
 */
async function main() {
  try {
    // コマンドライン引数を解析
    const args = process.argv.slice(2);
    const command = args[0];

    // 設定読み込み
    const config = loadAmbientConfig();

    // コマンド実行
    switch (command) {
      case 'run':
      case undefined: {
        // オプション解析
        let lookaheadHours: number | undefined;
        let dryRun = false;
        let generateAgenda = false;
        let deliver = false;

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg === '--dry-run' || arg === '-d') {
            dryRun = true;
          } else if (arg === '--generate-agenda' || arg === '-g') {
            generateAgenda = true;
          } else if (arg === '--deliver') {
            deliver = true;
          } else if (arg === '--lookahead') {
            const value = args[i + 1];
            if (value && value.endsWith('h')) {
              lookaheadHours = parseInt(value.slice(0, -1));
              i++; // 次の引数をスキップ
            }
          }
        }

        await runCommand(config, { lookaheadHours, dryRun, generateAgenda, deliver });
        break;
      }

      case 'list':
        console.log('📋 list コマンドは未実装です（Milestone 4で実装予定）');
        break;

      case 'approve':
        console.log('✅ approve コマンドは未実装です（Milestone 4で実装予定）');
        break;

      case 'inspect':
        console.log('🔍 inspect コマンドは未実装です（Milestone 4で実装予定）');
        break;

      case 'drop':
        console.log('🗑️  drop コマンドは未実装です（Milestone 4で実装予定）');
        break;

      case 'regen':
        console.log('🔄 regen コマンドは未実装です（Milestone 4で実装予定）');
        break;

      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;

      default:
        console.error(`❌ 不明なコマンド: ${command}`);
        console.log();
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 予期しないエラーが発生しました:');
    if (error instanceof Error) {
      console.error(error.message);

      if (process.env.DEBUG) {
        console.error('\nスタックトレース:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    // データベース接続をクローズ
    await closeGlobalDatabaseConnection();
  }
}

/**
 * ヘルプメッセージを表示する
 */
function printHelp() {
  console.log(`
Ambient Agent CLI - ゼロタッチ 1on1 アジェンダエージェント

使い方:
  ambient [command] [options]

コマンド:
  run [options]         カレンダーから1on1を抽出してJobを作成
    --lookahead <hours>   先読み時間（例: --lookahead 48h）
    --dry-run, -d         ドライランモード
    --generate-agenda, -g アジェンダを自動生成
    --deliver             アジェンダをSlack DMに配信（-gと併用）

  list [options]        Job一覧を表示（未実装）
  approve <job_id>      Jobを承認（未実装）
  inspect <job_id>      Job詳細を表示（未実装）
  drop <job_id>         Jobを削除（未実装）
  regen <job_id>        Jobを再生成（未実装）

  help, --help, -h      このヘルプを表示

例:
  ambient run
  ambient run --lookahead 24h
  ambient run --dry-run
  ambient run --generate-agenda --deliver
`);
}

// 実行
main().catch((error) => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});
