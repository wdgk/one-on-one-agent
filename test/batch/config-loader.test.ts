import { describe, it, expect } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { ConfigLoader } from '../../src/batch/config-loader.js';

describe('ConfigLoader', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const testConfigPath = join(testDir, 'test-config.yaml');

  // テスト用の一時ディレクトリを作成
  async function setupTestDir() {
    await mkdir(testDir, { recursive: true });
  }

  // テスト後のクリーンアップ
  async function cleanupTestDir() {
    try {
      await unlink(testConfigPath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  describe('load', () => {
    it('正常なYAML設定ファイルを読み込める', async () => {
      await setupTestDir();

      const yamlContent = `
members:
  - name: 佐藤太郎
    period:
      weeks: 2
  - name: 田中花子
    period:
      months: 1

options:
  maxConcurrency: 3
  continueOnError: true
  outputDir: output
`;

      await writeFile(testConfigPath, yamlContent, 'utf-8');

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.members).toHaveLength(2);
      expect(config.members[0].name).toBe('佐藤太郎');
      expect(config.members[0].period?.weeks).toBe(2);
      expect(config.members[1].name).toBe('田中花子');
      expect(config.members[1].period?.months).toBe(1);

      expect(config.options.maxConcurrency).toBe(3);
      expect(config.options.continueOnError).toBe(true);
      expect(config.options.outputDir).toBe('output');

      await cleanupTestDir();
    });

    it('無効なYAMLの場合はエラーをスローする', async () => {
      await setupTestDir();

      const invalidYaml = `
members:
  - name: 佐藤太郎
    period
      weeks: 2
`;

      await writeFile(testConfigPath, invalidYaml, 'utf-8');

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow();

      await cleanupTestDir();
    });

    it('必須フィールドが欠けている場合はエラーをスローする', async () => {
      await setupTestDir();

      const missingFieldYaml = `
options:
  maxConcurrency: 3
`;

      await writeFile(testConfigPath, missingFieldYaml, 'utf-8');

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'members is required'
      );

      await cleanupTestDir();
    });

    it('メンバー名が空の場合はエラーをスローする', async () => {
      await setupTestDir();

      const emptyNameYaml = `
members:
  - name: ""
    period:
      weeks: 2

options:
  maxConcurrency: 3
  continueOnError: true
  outputDir: output
`;

      await writeFile(testConfigPath, emptyNameYaml, 'utf-8');

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'Member name cannot be empty'
      );

      await cleanupTestDir();
    });

    it('optionsが省略された場合はデフォルト値を適用する', async () => {
      await setupTestDir();

      const minimalYaml = `
members:
  - name: 佐藤太郎
`;

      await writeFile(testConfigPath, minimalYaml, 'utf-8');

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.options.maxConcurrency).toBe(3);
      expect(config.options.continueOnError).toBe(true);
      expect(config.options.outputDir).toBe('output');

      await cleanupTestDir();
    });

    it('ファイルが存在しない場合はエラーをスローする', async () => {
      const nonExistentPath = join(testDir, 'non-existent.yaml');

      await expect(ConfigLoader.load(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('getDefaultConfigPath', () => {
    it('デフォルト設定ファイルパスを返す', () => {
      const defaultPath = ConfigLoader.getDefaultConfigPath();

      expect(defaultPath).toContain('agenda-config.yaml');
    });
  });
});
