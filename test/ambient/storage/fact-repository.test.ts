import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import type { Fact } from '../../../src/ambient/storage/types.js';

describe('FactRepository', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let factRepository: FactRepository;
  let dbPath: string;
  let testJobId: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    factRepository = new FactRepository(db);

    // テスト用のJobを作成
    const job = await jobRepository.upsert({
      eventId: 'test-event-1',
      attendeeEmail: 'test@example.com',
      attendeeName: 'Test User',
      startAt: '2025-01-15T10:00:00Z',
      endAt: '2025-01-15T11:00:00Z',
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('create', () => {
    it('Factを作成できること', async () => {
      const fact = await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'テストメッセージ',
        url: 'https://slack.com/archives/C123/p1234567890',
        confidence: 0.9,
        score: 5.0,
        rawRef: JSON.stringify({ channel: 'general', ts: '1234567890' }),
      });

      expect(fact.id).toBeTruthy();
      expect(fact.jobId).toBe(testJobId);
      expect(fact.source).toBe('slack');
      expect(fact.occurredAt).toBe('2025-01-10T10:00:00Z');
      expect(fact.summary).toBe('テストメッセージ');
      expect(fact.url).toBe('https://slack.com/archives/C123/p1234567890');
      expect(fact.confidence).toBe(0.9);
      expect(fact.score).toBe(5.0);
      expect(fact.rawRef).toBeTruthy();
      expect(fact.createdAt).toBeTruthy();
    });

    it('デフォルト値でFactを作成できること', async () => {
      const fact = await factRepository.create({
        jobId: testJobId,
        source: 'backlog',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'Backlog課題',
        url: 'https://example.backlog.com/view/PROJ-123',
        rawRef: JSON.stringify({ issueKey: 'PROJ-123' }),
      });

      expect(fact.confidence).toBe(1.0);
      expect(fact.score).toBe(0.0);
    });
  });

  describe('findById', () => {
    it('IDでFactを検索できること', async () => {
      const created = await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'テストメッセージ',
        url: 'https://slack.com/test',
        rawRef: '{}',
      });

      const found = await factRepository.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.summary).toBe('テストメッセージ');
    });

    it('存在しないIDの場合はnullを返すこと', async () => {
      const found = await factRepository.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByJobId', () => {
    it('Job単位でFactを検索できること', async () => {
      await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'Slackメッセージ',
        url: 'https://slack.com/test1',
        rawRef: '{}',
      });

      await factRepository.create({
        jobId: testJobId,
        source: 'backlog',
        occurredAt: '2025-01-11T10:00:00Z',
        summary: 'Backlog課題',
        url: 'https://backlog.com/test1',
        rawRef: '{}',
      });

      const facts = await factRepository.findByJobId(testJobId);

      expect(facts).toHaveLength(2);
      expect(facts.map(f => f.source).sort()).toEqual(['backlog', 'slack']);
    });

    it('occurred_atの降順でソートされること', async () => {
      await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: '古いメッセージ',
        url: 'https://slack.com/test1',
        rawRef: '{}',
      });

      await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-12T10:00:00Z',
        summary: '新しいメッセージ',
        url: 'https://slack.com/test2',
        rawRef: '{}',
      });

      const facts = await factRepository.findByJobId(testJobId);

      expect(facts[0].summary).toBe('新しいメッセージ');
      expect(facts[1].summary).toBe('古いメッセージ');
    });

    it('該当するFactがない場合は空配列を返すこと', async () => {
      const facts = await factRepository.findByJobId('non-existent-job');
      expect(facts).toHaveLength(0);
    });
  });

  describe('findBySource', () => {
    it('ソースでFactをフィルタできること', async () => {
      await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'Slackメッセージ',
        url: 'https://slack.com/test1',
        rawRef: '{}',
      });

      await factRepository.create({
        jobId: testJobId,
        source: 'backlog',
        occurredAt: '2025-01-11T10:00:00Z',
        summary: 'Backlog課題',
        url: 'https://backlog.com/test1',
        rawRef: '{}',
      });

      const slackFacts = await factRepository.findBySource(testJobId, 'slack');
      const backlogFacts = await factRepository.findBySource(testJobId, 'backlog');

      expect(slackFacts).toHaveLength(1);
      expect(slackFacts[0].source).toBe('slack');
      expect(backlogFacts).toHaveLength(1);
      expect(backlogFacts[0].source).toBe('backlog');
    });
  });

  describe('findByUrl', () => {
    it('URLでFactを検索できること（重複チェック用）', async () => {
      const created = await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'テストメッセージ',
        url: 'https://slack.com/archives/C123/p1234567890',
        rawRef: '{}',
      });

      const found = await factRepository.findByUrl(
        testJobId,
        'https://slack.com/archives/C123/p1234567890'
      );

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
    });

    it('存在しないURLの場合はnullを返すこと', async () => {
      const found = await factRepository.findByUrl(testJobId, 'https://non-existent.com');
      expect(found).toBeNull();
    });
  });

  describe('updateScore', () => {
    it('スコアを更新できること', async () => {
      const fact = await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'テストメッセージ',
        url: 'https://slack.com/test',
        rawRef: '{}',
      });

      expect(fact.score).toBe(0.0);

      const updated = await factRepository.updateScore(fact.id, 8.5);

      expect(updated.score).toBe(8.5);
    });
  });

  describe('delete', () => {
    it('Factを削除できること', async () => {
      const fact = await factRepository.create({
        jobId: testJobId,
        source: 'slack',
        occurredAt: '2025-01-10T10:00:00Z',
        summary: 'テストメッセージ',
        url: 'https://slack.com/test',
        rawRef: '{}',
      });

      await factRepository.delete(fact.id);

      const found = await factRepository.findById(fact.id);
      expect(found).toBeNull();
    });
  });
});
