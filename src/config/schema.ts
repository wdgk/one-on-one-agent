/**
 * Zodベースの統一設定スキーマ
 */
import { z } from 'zod';

/**
 * CSV文字列を配列に変換するスキーマ
 */
const csvToArray = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === '') return [];
    return val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  });

/**
 * 基本設定スキーマ（agenda CLI用）
 */
export const baseConfigSchema = z.object({
  backlog: z.object({
    domain: z
      .string()
      .min(1, 'BACKLOG_DOMAIN が設定されていません')
      .describe('Backlog スペースのドメイン（例: your-space.backlog.com）'),
    apiKey: z
      .string()
      .min(1, 'BACKLOG_API_KEY が設定されていません')
      .describe('Backlog API キー（個人設定から取得）'),
  }),
  slack: z
    .object({
      botToken: z.string().optional(),
      userToken: z.string().optional(),
    })
    .optional()
    .default({}),
  calendar: z
    .object({
      credentialsPath: z.string().optional(),
      tokenPath: z.string().optional(),
    })
    .optional()
    .default({}),
  options: z
    .object({
      maxConcurrency: z.number().optional(),
      continueOnError: z.boolean().optional(),
      outputDir: z.string().optional(),
      dryRun: z.boolean().optional(),
      templateDir: z.string().optional(),
    })
    .optional()
    .default({}),
});

/**
 * Ambient Agent用の情報源設定スキーマ
 */
const sourcesSchema = z.object({
  slack: z.object({
    channelWhitelist: csvToArray.default([]),
    lookbackDays: z.coerce.number().default(14),
  }),
  backlog: z.object({
    projectWhitelist: csvToArray.default([]),
    lookbackDays: z.coerce.number().default(14),
  }),
  github: z.object({
    repoWhitelist: csvToArray.default([]),
    lookbackDays: z.coerce.number().default(14),
  }),
});

/**
 * Ambient Agent用のポリシー設定スキーマ
 */
const policySchema = z.object({
  confidenceThreshold: z.coerce.number().default(0.7),
  evidenceRatioThreshold: z.coerce.number().default(0.8),
  autoDispatch: z.coerce.boolean().default(false),
});

/**
 * Ambient Agent設定スキーマ（base設定を継承）
 */
export const ambientConfigSchema = baseConfigSchema.extend({
  myEmail: z
    .string()
    .email('AMBIENT_MY_EMAIL は有効なメールアドレスである必要があります')
    .describe('自分のメールアドレス'),
  internalDomain: z
    .string()
    .min(1, 'AMBIENT_INTERNAL_DOMAIN が設定されていません')
    .describe('内部ドメイン'),
  dbPath: z.string().default('./ambient.db'),
  outputDir: z.string().default('./1on1-agendas'),
  lookaheadHours: z.coerce.number().default(48),
  sources: sourcesSchema.default({
    slack: { channelWhitelist: [], lookbackDays: 14 },
    backlog: { projectWhitelist: [], lookbackDays: 14 },
    github: { repoWhitelist: [], lookbackDays: 14 },
  }),
  policy: policySchema.default({
    confidenceThreshold: 0.7,
    evidenceRatioThreshold: 0.8,
    autoDispatch: false,
  }),
});

/**
 * 基本設定の型
 */
export type AppConfig = z.infer<typeof baseConfigSchema>;

/**
 * Ambient Agent設定の型
 */
export type AmbientConfig = z.infer<typeof ambientConfigSchema>;
