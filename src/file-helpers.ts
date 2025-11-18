/**
 * ファイル操作のヘルパー関数
 */

/**
 * ファイル名として使用できない文字を安全な文字に置換する
 * @param filename 元のファイル名
 * @returns サニタイズされたファイル名
 */
export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    // 先頭・末尾の空白やドットを除去（Windowsで問題になる）
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // 制御文字を除去
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    // ファイルシステムで使用できない文字を除去
    // Windows: < > : " / \ | ? *
    // Unix/Mac: / (他の文字は技術的には使えるが、互換性のため除去)
    .replace(/[<>:"/\\|?*]/g, '-')
    // 連続する空白を1つのアンダースコアに
    .replace(/\s+/g, '_')
    // 先頭・末尾の - や _ を除去（変換結果のクリーンアップ）
    .replace(/^[-_]+|[-_]+$/g, '');

  // 空文字列になった場合のフォールバック
  return sanitized || 'untitled';
}

/**
 * アジェンダファイルの命名規則に従ったファイル名を生成する
 * @param memberName メンバー名
 * @param date 日付文字列（YYYY-MM-DD形式）
 * @returns サニタイズされたファイル名（拡張子なし）
 */
export function generateAgendaFilename(memberName: string, date: string): string {
  const sanitizedName = sanitizeFilename(memberName);
  const sanitizedDate = sanitizeFilename(date);
  return `agenda_${sanitizedName}_${sanitizedDate}`;
}
