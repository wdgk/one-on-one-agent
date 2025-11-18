import { readFile } from 'fs/promises';
import { join } from 'path';
import * as yaml from 'js-yaml';
import type { BatchConfig, Member } from '../model/batch.js';

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
    const parsed = yaml.load(fileContent) as unknown;

    // 型チェック
    if (!this.isValidConfig(parsed)) {
      throw new Error('Invalid configuration format');
    }

    // membersフィールドの存在チェック
    if (parsed.members === undefined) {
      throw new Error('members is required and must be an array');
    }

    // 設定を構築
    const options = (parsed.options || {}) as Record<string, unknown>;
    const config: BatchConfig = {
      members: parsed.members,
      options: {
        maxConcurrency: typeof options.maxConcurrency === 'number' ? options.maxConcurrency : 3,
        continueOnError: typeof options.continueOnError === 'boolean' ? options.continueOnError : true,
        outputDir: typeof options.outputDir === 'string' ? options.outputDir : 'output',
      },
    };

    // バリデーション
    this.validate(config);

    return config;
  }

  /**
   * パース結果が有効な設定形式かチェック
   * @param value パース結果
   * @returns 有効な設定形式の場合true
   */
  private static isValidConfig(value: unknown): value is { members?: Member[]; options?: unknown } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // membersが存在しない場合はvalidateで詳細なエラーを出すため、ここでは通す
    if (obj.members === undefined) {
      return true;
    }

    // membersが配列であることを確認
    if (!Array.isArray(obj.members)) {
      return false;
    }

    // 各メンバーが必要な構造を持っているか確認
    return obj.members.every((member) => {
      if (typeof member !== 'object' || member === null) {
        return false;
      }
      return 'name' in member;
    });
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

        // 複数の期間指定がないかチェック
        const specifiedFields = [weeks, months, days].filter(v => v !== undefined).length;
        if (specifiedFields > 1) {
          throw new Error(`Member "${member.name}": weeks, months, days のうち1つだけ指定してください`);
        }

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
