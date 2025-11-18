#!/usr/bin/env node

import 'dotenv/config';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { OneOnOneAgendaAgent } from './agent.js';
import { generateAgendaFilename } from './file-helpers.js';

/**
 * CLIエントリーポイント
 */
async function main() {
  // コマンドライン引数を取得
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('使い方: npm run agenda "メンバー名の直近N週間"');
    console.error('例: npm run agenda "佐藤さんの直近2週間の1on1アジェンダを作成して"');
    process.exit(1);
  }

  const inputText = args.join(' ');

  console.log('🚀 1on1アジェンダ生成を開始します...');
  console.log(`入力: ${inputText}\n`);

  const agent = new OneOnOneAgendaAgent();

  try {
    // アジェンダ生成
    console.log('📝 パラメータを抽出中...');
    const result = await agent.generateAgenda(inputText);

    console.log('✅ アジェンダ生成完了！\n');

    // メタデータ表示
    console.log('--- 生成情報 ---');
    console.log(`メンバー: ${result.metadata.memberName}`);
    console.log(`期間: ${result.metadata.periodStart} 〜 ${result.metadata.periodEnd}`);
    console.log(`課題数: ${result.metadata.issueCount}件`);
    console.log(`生成日時: ${new Date(result.metadata.generatedAt).toLocaleString('ja-JP')}\n`);

    // ファイル保存
    const outputDir = join(process.cwd(), 'output');
    await mkdir(outputDir, { recursive: true });

    const fileName = generateAgendaFilename(
      result.metadata.memberName,
      result.metadata.periodEnd
    ) + '.md';

    const filePath = join(outputDir, fileName);
    await writeFile(filePath, result.markdown, 'utf-8');

    console.log('💾 ファイル保存完了！');
    console.log(`保存先: ${filePath}\n`);

    console.log('--- プレビュー ---');
    console.log(result.markdown.substring(0, 500));
    if (result.markdown.length > 500) {
      console.log('\n...(続きはファイルをご確認ください)');
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    if (error instanceof Error) {
      console.error(error.message);

      // デバッグ情報（本番では非表示にすることも検討）
      if (process.env.DEBUG) {
        console.error('\nスタックトレース:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    // クリーンアップ
    await agent.cleanup();
  }
}

// 実行
main().catch((error) => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});
