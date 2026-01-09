#!/usr/bin/env node

import 'dotenv/config';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { OneOnOneAgendaAgent } from './agent.js';
import { generateAgendaFilename } from './file-helpers.js';

/**
 * AWS SSOプロファイルから認証情報を解決して環境変数に設定する
 */
async function setupAwsCredentials() {
  // AWS_PROFILEが設定されている場合のみ処理する
  if (!process.env.AWS_PROFILE) {
    return;
  }

  // すでにAWS_ACCESS_KEY_IDが設定されている場合はスキップ
  if (process.env.AWS_ACCESS_KEY_ID) {
    return;
  }

  try {
    // AWS SDKの認証プロバイダーチェーンを使用して認証情報を解決
    const credentialsProvider = fromNodeProviderChain({
      profile: process.env.AWS_PROFILE,
    });

    const credentials = await credentialsProvider();

    // 解決した認証情報を環境変数に設定
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    if (credentials.sessionToken) {
      process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
    }
  } catch (error) {
    // 認証情報の解決に失敗した場合は警告を表示
    console.warn(
      `⚠️  AWS認証情報の解決に失敗しました (プロファイル: ${process.env.AWS_PROFILE})`
    );
    if (error instanceof Error) {
      console.warn(`   ${error.message}`);
    }
    console.warn(
      '   AWS SSOを使用している場合は、`aws sso login --profile ' +
        process.env.AWS_PROFILE +
        '`でログインしてください。\n'
    );
  }
}

/**
 * CLIエントリーポイント
 */
async function main() {
  // AWS認証情報を設定
  await setupAwsCredentials();
  const agent = new OneOnOneAgendaAgent();

  try {
    // コマンドライン引数を取得
    const args = process.argv.slice(2);

    // --dry-run フラグをチェック
    let dryRun = false;
    const filteredArgs = args.filter(arg => {
      if (arg === '--dry-run' || arg === '-d') {
        dryRun = true;
        return false;
      }
      return true;
    });

    let inputText = filteredArgs.join(' ');

    if (dryRun) {
      console.log('🧪 ドライランモード: LLMによる生成をスキップします\n');
    }

    // 引数がない場合は対話モード
    if (!inputText) {
      console.log('🚀 1on1アジェンダ生成エージェントへようこそ！\n');
      const response = await prompts({
        type: 'text',
        name: 'value',
        message: 'どのようなアジェンダを作成しますか？',
        initial: '佐藤さんの直近2週間のアジェンダを作成して',
      });

      if (!response.value) {
        console.log('キャンセルされました。');
        process.exit(0);
      }
      inputText = response.value;
    } else {
      console.log('🚀 1on1アジェンダ生成を開始します...');
      console.log(`入力: ${inputText}\n`);
    }

    // パラメータ抽出
    console.log('📝 パラメータを抽出中...');
    const parsed = await agent.parseInput(inputText);
    console.log(`  メンバー名: ${parsed.memberName}`);
    console.log(`  期間: ${JSON.stringify(parsed.period)}\n`);

    // メンバー検索
    console.log('🔍 メンバーを検索中...');
    const members = await agent.searchMember(parsed.memberName);

    let targetMember;

    if (members.length === 0) {
      console.error(`❌ ユーザーが見つかりません: ${parsed.memberName}`);
      process.exit(1);
    } else if (members.length === 1) {
      targetMember = members[0];
      console.log(`✅ メンバーを特定しました: ${targetMember.name} (${targetMember.mailAddress})\n`);
    } else {
      // 複数ヒットした場合は選択
      console.log(`⚠️ 複数のユーザーがマッチしました: ${parsed.memberName}`);
      const response = await prompts({
        type: 'select',
        name: 'member',
        message: '対象のメンバーを選択してください',
        choices: members.map(m => ({
          title: `${m.name} (${m.mailAddress})`,
          value: m,
        })),
      });

      if (!response.member) {
        console.log('キャンセルされました。');
        process.exit(0);
      }
      targetMember = response.member;
      console.log(`✅ メンバーを選択しました: ${targetMember.name}\n`);
    }

    // アジェンダ生成
    if (dryRun) {
      console.log('📋 データを取得中...');
    } else {
      console.log('🤖 アジェンダを生成中...');
    }
    const result = await agent.generateAgendaWithParams(targetMember, parsed.period, { dryRun });

    if (dryRun) {
      console.log('✅ データ取得完了！\n');
    } else {
      console.log('✅ アジェンダ生成完了！\n');
    }

    // メタデータ表示
    console.log('--- 生成情報 ---');
    console.log(`メンバー: ${result.metadata.memberName}`);
    console.log(`期間: ${result.metadata.periodStart} 〜 ${result.metadata.periodEnd}`);
    console.log(`課題数: ${result.metadata.issueCount}件`);
    console.log(`生成日時: ${new Date(result.metadata.generatedAt).toLocaleString('ja-JP')}\n`);

    if (dryRun) {
      // ドライランモード: ファイル保存せずにプレビューのみ表示
      console.log('--- データプレビュー ---');
      console.log(result.markdown.substring(0, 500));
      if (result.markdown.length > 500) {
        console.log('\n...(以下省略)');
      }
      console.log('\n💡 ドライランモードのため、ファイルは保存されませんでした。');
    } else {
      // 通常モード: ファイル保存
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
