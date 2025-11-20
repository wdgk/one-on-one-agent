#!/usr/bin/env node

import 'dotenv/config';
import { ConfigLoader } from './batch/config-loader.js';
import { BatchAgendaGenerator } from './batch/batch-generator.js';
import { formatPeriod } from './batch/period-formatter.js';

/**
 * バッチCLIエントリーポイント
 */
async function main() {
  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  let configPath = ConfigLoader.getDefaultConfigPath();
  let dryRun = false;
  let verbose = false;

  // 引数をパース
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--config' || arg === '-c') {
      if (i + 1 >= args.length) {
        console.error('❌ エラー: --config には設定ファイルのパスを指定してください');
        process.exit(1);
      }
      configPath = args[++i];
    } else if (arg === '--dry-run' || arg === '-d') {
      dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  try {
    console.log('🚀 バッチアジェンダ生成を開始します...\n');

    // 設定ファイルを読み込む
    if (verbose) {
      console.log(`📄 設定ファイル: ${configPath}`);
    }

    const config = await ConfigLoader.load(configPath);

    console.log(`📝 対象メンバー数: ${config.members.length}人`);
    console.log(`⚙️  最大並列実行数: ${config.options.maxConcurrency}`);
    console.log(`🔄 エラー時続行: ${config.options.continueOnError ? 'はい' : 'いいえ'}\n`);

    // メンバー一覧を表示
    console.log('--- 対象メンバー ---');
    for (const member of config.members) {
      const periodText = formatPeriod(member.period);
      console.log(`  - ${member.name} (${periodText})`);
    }
    console.log();

    // ドライランの設定を反映
    if (dryRun) {
      console.log('🔍 ドライラン: LLM生成をスキップしてデータを取得します');
      config.options.dryRun = true;
    }

    // バッチ生成を実行
    const generator = new BatchAgendaGenerator();

    try {
      console.log('⏳ アジェンダ生成中...\n');

      const result = await generator.generateBatch(config);

      // 結果を表示
      console.log('✅ バッチ生成完了！\n');

      console.log('--- 生成結果 ---');
      console.log(`総メンバー数: ${result.total}人`);
      console.log(`成功: ${result.succeeded}人`);
      console.log(`失敗: ${result.failed}人`);
      console.log(`出力先: ${result.outputDir}\n`);

      // 成功したメンバー
      if (result.succeeded > 0) {
        console.log('✅ 成功したメンバー:');
        for (const memberResult of result.results) {
          if (memberResult.status === 'success') {
            const durationSec = (memberResult.duration / 1000).toFixed(1);
            console.log(`  - ${memberResult.memberName} (${durationSec}秒)`);
          }
        }
        console.log();
      }

      // 失敗したメンバー
      if (result.failed > 0) {
        console.log('❌ 失敗したメンバー:');
        for (const memberResult of result.results) {
          if (memberResult.status === 'error') {
            console.log(`  - ${memberResult.memberName}`);
            if (verbose) {
              console.log(`    エラー: ${memberResult.error}`);
            }
          }
        }
        console.log();
      }

      console.log('📋 サマリーレポート: summary.md');

      // 全員失敗した場合はエラー終了
      if (result.failed === result.total) {
        console.error('\n❌ すべてのメンバーで生成に失敗しました');
        process.exit(1);
      }
    } finally {
      await generator.cleanup();
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
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
  }
}

/**
 * ヘルプメッセージを表示
 */
function showHelp() {
  console.log(`
バッチアジェンダ生成ツール

使い方:
  npm run agenda:batch [オプション]

オプション:
  -c, --config <path>   設定ファイルのパス (デフォルト: agenda-config.yaml)
  -d, --dry-run         ドライラン（実際の生成は行わない）
  -v, --verbose         詳細出力
  -h, --help            このヘルプを表示

例:
  # デフォルト設定で実行
  npm run agenda:batch

  # カスタム設定ファイルを指定
  npm run agenda:batch -- --config custom-config.yaml

  # ドライラン
  npm run agenda:batch -- --dry-run

  # 詳細出力
  npm run agenda:batch -- --verbose
`);
}

// 実行
main().catch((error) => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});
