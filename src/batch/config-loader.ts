import { readFile } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';
import type { BatchConfig } from '../model/batch.js';

/**
 * 設定ファイル読み込みクラス
 */
export class ConfigLoader {
  /**
   * 設定ファイルを読み込む
   * @param configPath 設定ファイルのパス
   * @returns バッチ設定
   */
  static async load(configPath: string): Promise<BatchConfig> {
    // ファイルを読み込む
    const fileContent = await readFile(configPath, 'utf-8');

    // YAMLをパース
    const parsed = yaml.load(fileContent) as Record<string, unknown>;

    // 設定を構築
    const config: BatchConfig = {
      members: parsed.members as BatchConfig['members'],
      options: {
        maxConcurrency: (parsed.options as Record<string, unknown>)?.maxConcurrency as number ?? 3,
        continueOnError: (parsed.options as Record<string, unknown>)?.continueOnError as boolean ?? true,
        outputDir: (parsed.options as Record<string, unknown>)?.outputDir as string ?? 'output',
      },
    };

    // バリデーション
    this.validate(config);

    return config;
  }

  /**
   * 設定のバリデーション
   * @param config バッチ設定
   * @throws 設定が無効な場合
   */
  private static validate(config: BatchConfig): void {
    // membersが必須
    if (!config.members || !Array.isArray(config.members)) {
      throw new Error('members is required and must be an array');
    }

    // メンバーが空でないこと
    if (config.members.length === 0) {
      throw new Error('members array cannot be empty');
    }

    // 各メンバーのバリデーション
    for (const member of config.members) {
      if (typeof member.name !== 'string') {
        throw new Error('Member name is required and must be a string');
      }

      if (member.name.trim() === '') {
        throw new Error('Member name cannot be empty');
      }

      // periodが指定されている場合のバリデーション
      if (member.period) {
        const { weeks, months, days } = member.period;

        if (weeks !== undefined && (typeof weeks !== 'number' || weeks <= 0)) {
          throw new Error('weeks must be a positive number');
        }

        if (months !== undefined && (typeof months !== 'number' || months <= 0)) {
          throw new Error('months must be a positive number');
        }

        if (days !== undefined && (typeof days !== 'number' || days <= 0)) {
          throw new Error('days must be a positive number');
        }
      }
    }

    // optionsのバリデーション
    if (config.options.maxConcurrency <= 0) {
      throw new Error('maxConcurrency must be a positive number');
    }
  }

  /**
   * デフォルト設定ファイルのパスを取得
   * @returns デフォルト設定ファイルパス
   */
  static getDefaultConfigPath(): string {
    return join(process.cwd(), 'agenda-config.yaml');
  }
}
