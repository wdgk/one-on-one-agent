import { describe, it, expect } from 'vitest';
import { sanitizeFilename, generateAgendaFilename } from '../src/file-helpers.js';

describe('file-helpers', () => {
  describe('sanitizeFilename', () => {
    it('連続する空白を1つのアンダースコアに変換する', () => {
      expect(sanitizeFilename('hello   world')).toBe('hello_world');
      expect(sanitizeFilename('a  b  c')).toBe('a_b_c');
    });

    it('ファイルシステムで使用できない文字をハイフンに変換する', () => {
      expect(sanitizeFilename('file<name>.txt')).toBe('file-name-.txt');
      expect(sanitizeFilename('file>name')).toBe('file-name');
      expect(sanitizeFilename('file:name')).toBe('file-name');
      expect(sanitizeFilename('file"name')).toBe('file-name');
      expect(sanitizeFilename('file/name')).toBe('file-name');
      expect(sanitizeFilename('file\\name')).toBe('file-name');
      expect(sanitizeFilename('file|name')).toBe('file-name');
      expect(sanitizeFilename('file?name')).toBe('file-name');
      expect(sanitizeFilename('file*name')).toBe('file-name');
    });

    it('複数の特殊文字を含むファイル名を正しく処理する', () => {
      expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file---------name');
    });

    it('制御文字を除去する', () => {
      expect(sanitizeFilename('file\x00name')).toBe('filename');
      expect(sanitizeFilename('file\x1fname')).toBe('filename');
      expect(sanitizeFilename('file\x80name')).toBe('filename');
    });

    it('先頭と末尾の空白を除去する', () => {
      expect(sanitizeFilename('  filename  ')).toBe('filename');
      expect(sanitizeFilename('\t\nfilename\t\n')).toBe('filename');
    });

    it('先頭と末尾のドットを除去する', () => {
      expect(sanitizeFilename('.filename.')).toBe('filename');
      expect(sanitizeFilename('...filename...')).toBe('filename');
    });

    it('空文字列になった場合、untitledを返す', () => {
      expect(sanitizeFilename('')).toBe('untitled');
      expect(sanitizeFilename('   ')).toBe('untitled');
      expect(sanitizeFilename('...')).toBe('untitled');
      expect(sanitizeFilename('<>:"/\\|?*')).toBe('untitled');
    });

    it('日本語を含むファイル名を正しく処理する', () => {
      expect(sanitizeFilename('田中 太郎')).toBe('田中_太郎');
      expect(sanitizeFilename('佐藤さん')).toBe('佐藤さん');
    });

    it('複数の変換ルールを組み合わせて処理する', () => {
      expect(sanitizeFilename('  file name<test>.txt  ')).toBe('file_name-test-.txt');
      expect(sanitizeFilename('.  spaces  and  dots  .')).toBe('spaces_and_dots');
    });
  });

  describe('generateAgendaFilename', () => {
    it('正常なメンバー名と日付からファイル名を生成する', () => {
      expect(generateAgendaFilename('佐藤太郎', '2025-11-17')).toBe('agenda_佐藤太郎_2025-11-17');
      expect(generateAgendaFilename('Taro Yamada', '2025-01-01')).toBe('agenda_Taro_Yamada_2025-01-01');
    });

    it('特殊文字を含むメンバー名を正しく処理する', () => {
      expect(generateAgendaFilename('佐藤/太郎', '2025-11-17')).toBe('agenda_佐藤-太郎_2025-11-17');
      expect(generateAgendaFilename('Taro<Yamada>', '2025-11-17')).toBe('agenda_Taro-Yamada_2025-11-17');
    });

    it('空白を含むメンバー名を正しく処理する', () => {
      expect(generateAgendaFilename('佐藤  太郎', '2025-11-17')).toBe('agenda_佐藤_太郎_2025-11-17');
      expect(generateAgendaFilename('  田中花子  ', '2025-11-17')).toBe('agenda_田中花子_2025-11-17');
    });

    it('日付文字列もサニタイズする', () => {
      expect(generateAgendaFilename('佐藤', '2025/11/17')).toBe('agenda_佐藤_2025-11-17');
    });

    it('メンバー名が空の場合、untitledを使用する', () => {
      expect(generateAgendaFilename('', '2025-11-17')).toBe('agenda_untitled_2025-11-17');
      expect(generateAgendaFilename('   ', '2025-11-17')).toBe('agenda_untitled_2025-11-17');
    });
  });
});
