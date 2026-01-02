/**
 * Result型 - 成功/失敗を明示的に表現する型
 *
 * エラーをthrowする代わりに、Result型で明示的にエラーを返すことで：
 * - 関数シグネチャでエラー可能性が分かる
 * - エラーハンドリング漏れをTypeScriptで検出可能
 * - 部分的な成功/失敗を表現できる
 */

/**
 * Result型: 成功または失敗を表す
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Result型のユーティリティ関数
 */
export const Result = {
  /**
   * 成功結果を作成する
   */
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),

  /**
   * 失敗結果を作成する
   */
  err: <E>(error: E): Result<never, E> => ({ ok: false, error }),

  /**
   * 成功値を変換する
   */
  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
    result.ok ? Result.ok(fn(result.value)) : result,

  /**
   * エラー値を変換する
   */
  mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
    result.ok ? result : Result.err(fn(result.error)),

  /**
   * 成功値を取得する（失敗時はthrow）
   */
  unwrap: <T, E>(result: Result<T, E>): T => {
    if (result.ok) return result.value;
    throw result.error;
  },

  /**
   * 成功値を取得する（失敗時はデフォルト値）
   */
  unwrapOr: <T, E>(result: Result<T, E>, defaultValue: T): T =>
    result.ok ? result.value : defaultValue,

  /**
   * 成功値を取得する（失敗時は関数でデフォルト値を生成）
   */
  unwrapOrElse: <T, E>(result: Result<T, E>, fn: (error: E) => T): T =>
    result.ok ? result.value : fn(result.error),

  /**
   * 結果がokかどうかを判定（型ガード）
   */
  isOk: <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
    result.ok,

  /**
   * 結果がerrかどうかを判定（型ガード）
   */
  isErr: <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
    !result.ok,

  /**
   * Promise<T>をPromise<Result<T, E>>に変換する
   */
  fromPromise: async <T, E = Error>(
    promise: Promise<T>,
    mapError?: (error: unknown) => E
  ): Promise<Result<T, E>> => {
    try {
      const value = await promise;
      return Result.ok(value);
    } catch (error) {
      if (mapError) {
        return Result.err(mapError(error));
      }
      return Result.err(error as E);
    }
  },

  /**
   * 複数のResultを1つにまとめる（全て成功の場合のみ成功）
   */
  all: <T, E>(results: Result<T, E>[]): Result<T[], E> => {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }
    return Result.ok(values);
  },

  /**
   * 複数のResultから成功したものだけを抽出する
   */
  partition: <T, E>(
    results: Result<T, E>[]
  ): { successes: T[]; failures: E[] } => {
    const successes: T[] = [];
    const failures: E[] = [];
    for (const result of results) {
      if (result.ok) {
        successes.push(result.value);
      } else {
        failures.push(result.error);
      }
    }
    return { successes, failures };
  },
};
