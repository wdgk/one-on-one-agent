import type { FactRepository } from '../storage/fact-repository.js';
import type { ArtifactRepository } from '../storage/artifact-repository.js';
import type { FactTransformer } from '../transform/fact-transformer.js';
import type { OneOnOneAgendaAgent } from '../../agent.js';

/**
 * AgendaService - FactsからAgendaを生成するサービス
 */
export class AgendaService {
  constructor(
    private factRepository: FactRepository,
    private artifactRepository: ArtifactRepository,
    private transformer: FactTransformer,
    private agent?: OneOnOneAgendaAgent
  ) {}

  /**
   * FactsからAgendaを生成してArtifactを作成する
   * @param jobId Job ID
   * @param member メンバー情報
   * @param period 対象期間
   * @returns Artifact ID
   */
  async generateAgendaFromFacts(
    jobId: string,
    member: { id: string; name: string },
    period: { start: string; end: string }
  ): Promise<string> {
    // OneOnOneAgendaAgentが未設定の場合はエラー
    if (!this.agent) {
      throw new Error('OneOnOneAgendaAgentが設定されていません');
    }

    // 1. FactRepositoryからFactsを取得
    const facts = await this.factRepository.findByJobId(jobId);

    // 2. FactTransformerでAgendaInputに変換
    const agendaInput = this.transformer.transformToAgendaInput(member, period, facts);

    // 3. OneOnOneAgendaAgentでAgendaを生成
    const agendaOutput = await this.agent.generateAgendaFromInput(agendaInput);

    // 4. ArtifactRepositoryにArtifactを保存
    const artifact = await this.artifactRepository.create({
      jobId,
      artifactType: 'markdown',
      content: agendaOutput.markdown,
      metadata: agendaOutput.metadata,
    });

    // 5. Artifact IDを返す
    return artifact.id;
  }
}
