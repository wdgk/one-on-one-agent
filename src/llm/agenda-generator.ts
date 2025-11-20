import * as fs from 'fs/promises';
import * as path from 'path';
import handlebars from 'handlebars';
import type { AgendaInput } from '../model/agenda.js';
import { createLLMClient } from './factory.js';
import { LLMClient } from './types.js';

import { fileURLToPath } from 'url';

// ESMで__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AgendaInputからMarkdownアジェンダを生成するジェネレーター
 */
export class AgendaGenerator {
  private client: LLMClient;
  private templateDir: string;

  constructor(templateDir?: string) {
    this.client = createLLMClient();
    // デフォルトは src/templates (実行時は dist/templates になることを想定)
    // 開発環境と実行環境でパスが異なる可能性があるため、柔軟に解決する必要がある
    // 一旦、コンストラクタで渡されなければデフォルトを探すロジックにする
    this.templateDir = templateDir || path.resolve(__dirname, '../templates');

    this.registerHelpers();
  }

  private registerHelpers() {
    handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });
  }

  private async loadTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    const templatePath = path.join(this.templateDir, `${templateName}.hbs`);
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      return handlebars.compile(content);
    } catch (error) {
      console.error(`Failed to load template: ${templatePath}`, error);
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  /**
   * AgendaInputからMarkdown形式のアジェンダを生成する
   * @param input アジェンダ生成のための入力データ
   * @returns 生成されたMarkdownテキスト
   */
  async generate(input: AgendaInput): Promise<string> {
    const systemTemplate = await this.loadTemplate('system');
    const userTemplate = await this.loadTemplate('user');

    const systemPrompt = systemTemplate({});
    const userPrompt = userTemplate(input);

    return this.client.generateText(systemPrompt, userPrompt);
  }
}
