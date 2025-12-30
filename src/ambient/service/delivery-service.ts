import type { DeliveryRepository } from '../storage/delivery-repository.js';
import type { ArtifactRepository } from '../storage/artifact-repository.js';
import type { JobRepository } from '../storage/job-repository.js';
import type { SlackClient } from '../../slack/client.js';
import type { Delivery } from '../storage/types.js';

/**
 * DeliveryService - Artifactを配信するサービス
 */
export class DeliveryService {
  constructor(
    private deliveryRepository: DeliveryRepository,
    private artifactRepository: ArtifactRepository,
    private jobRepository: JobRepository,
    private slackClient: SlackClient
  ) {}

  /**
   * ArtifactをSlack DMに送信する
   * @param jobId Job ID
   * @param artifactId Artifact ID
   * @returns 作成されたDelivery
   */
  async sendToSlack(jobId: string, artifactId: string): Promise<Delivery> {
    // Artifactを取得
    const artifact = await this.artifactRepository.findById(artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // ArtifactがJobに属していることを検証
    if (artifact.jobId !== jobId) {
      throw new Error(`Artifact ${artifactId} does not belong to job ${jobId}`);
    }

    // Jobを取得
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // 既に配信成功済みかチェック（冪等性）
    const existingDeliveries = await this.deliveryRepository.findByJobIdAndRevision(
      jobId,
      artifact.revision
    );
    const existingSlackDelivery = existingDeliveries.find((d: Delivery) => d.channel === 'slack' && d.status === 'sent');
    if (existingSlackDelivery) {
      return existingSlackDelivery;
    }

    // Slackユーザーを解決
    const slackUser = await this.slackClient.findUserByEmail(job.attendeeEmail);
    if (!slackUser) {
      throw new Error(`Slack user not found for email: ${job.attendeeEmail}`);
    }

    // Slack DMに送信
    try {
      const response = await this.slackClient.sendDirectMessage(slackUser.id, artifact.content);

      // 成功時のDeliveryレコード作成
      return await this.deliveryRepository.create({
        jobId,
        revision: artifact.revision,
        channel: 'slack',
        target: slackUser.id,
        status: 'sent',
        externalId: response.ts,
      });
    } catch (error) {
      // 失敗時のDeliveryレコード作成
      await this.deliveryRepository.create({
        jobId,
        revision: artifact.revision,
        channel: 'slack',
        target: slackUser.id,
        status: 'failed',
        externalId: undefined,
      });
      throw error;
    }
  }
}
