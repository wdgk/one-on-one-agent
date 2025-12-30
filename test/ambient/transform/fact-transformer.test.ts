import { describe, it, expect } from 'vitest';
import { FactTransformer } from '../../../src/ambient/transform/fact-transformer.js';
import type { Fact } from '../../../src/ambient/storage/types.js';
import type { AgendaInput } from '../../../src/model/agenda.js';

describe('FactTransformer', () => {
  const transformer = new FactTransformer();

  const member = {
    id: 'user-123',
    name: '佐藤太郎',
  };

  const period = {
    start: '2025-01-01',
    end: '2025-01-14',
  };

  describe('transformToAgendaInput', () => {
    it('空のFactsで基本構造を返す', () => {
      const facts: Fact[] = [];

      const result = transformer.transformToAgendaInput(member, period, facts);

      expect(result).toEqual<AgendaInput>({
        member: { id: 'user-123', name: '佐藤太郎' },
        period: { start: '2025-01-01', end: '2025-01-14' },
        backlog: { issues: [], pullRequests: [] },
      });
    });

    it('BacklogソースのFactsをAgendaInput.backlogに変換する', () => {
      const facts: Fact[] = [
        {
          id: 'fact-1',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-05T10:00:00Z',
          summary: 'Issue: PROJ-123',
          url: 'https://example.backlog.com/view/PROJ-123',
          confidence: 1.0,
          score: 0.8,
          rawRef: JSON.stringify({
            id: 'issue-123',
            key: 'PROJ-123',
            title: 'Fix login bug',
            type: 'bug',
            status: 'InProgress',
            project: 'MyProject',
            url: 'https://example.backlog.com/view/PROJ-123',
            updatedAt: '2025-01-05T10:00:00Z',
            createdAt: '2025-01-01T09:00:00Z',
            priority: 'High',
          }),
          createdAt: '2025-01-05T10:00:00Z',
        },
        {
          id: 'fact-2',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-06T14:00:00Z',
          summary: 'PR: #42',
          url: 'https://example.backlog.com/git/MyProject/myrepo/pullRequests/42',
          confidence: 1.0,
          score: 0.9,
          rawRef: JSON.stringify({
            number: 42,
            title: 'Add new feature',
            description: 'This PR adds a new feature',
            status: 'Open',
            projectId: 'proj-1',
            repositoryId: 'repo-1',
            repositoryName: 'myrepo',
            url: 'https://example.backlog.com/git/MyProject/myrepo/pullRequests/42',
            createdAt: '2025-01-06T14:00:00Z',
            updatedAt: '2025-01-06T15:00:00Z',
          }),
          createdAt: '2025-01-06T14:00:00Z',
        },
      ];

      const result = transformer.transformToAgendaInput(member, period, facts);

      expect(result.backlog.issues).toHaveLength(1);
      expect(result.backlog.issues[0]).toEqual({
        id: 'issue-123',
        key: 'PROJ-123',
        title: 'Fix login bug',
        type: 'bug',
        status: 'InProgress',
        project: 'MyProject',
        url: 'https://example.backlog.com/view/PROJ-123',
        updatedAt: '2025-01-05T10:00:00Z',
        createdAt: '2025-01-01T09:00:00Z',
        priority: 'High',
      });

      expect(result.backlog.pullRequests).toHaveLength(1);
      expect(result.backlog.pullRequests[0]).toEqual({
        number: 42,
        title: 'Add new feature',
        description: 'This PR adds a new feature',
        status: 'Open',
        projectId: 'proj-1',
        repositoryId: 'repo-1',
        repositoryName: 'myrepo',
        url: 'https://example.backlog.com/git/MyProject/myrepo/pullRequests/42',
        createdAt: '2025-01-06T14:00:00Z',
        updatedAt: '2025-01-06T15:00:00Z',
      });
    });

    it('SlackソースのFactsをAgendaInput.slackに変換する', () => {
      const facts: Fact[] = [
        {
          id: 'fact-3',
          jobId: 'job-1',
          source: 'slack',
          occurredAt: '2025-01-07T09:30:00Z',
          summary: '#general: Hello team',
          url: 'https://example.slack.com/archives/C123/p1704617400',
          confidence: 1.0,
          score: 0.5,
          rawRef: JSON.stringify({
            id: '1704617400.123456',
            text: 'Hello team, great work!',
            user: 'U123',
            channel: 'C123',
            channelName: 'general',
            ts: '1704617400.123456',
            permalink: 'https://example.slack.com/archives/C123/p1704617400',
            type: 'message',
          }),
          createdAt: '2025-01-07T09:30:00Z',
        },
      ];

      const result = transformer.transformToAgendaInput(member, period, facts);

      expect(result.slack).toBeDefined();
      expect(result.slack!.messages).toHaveLength(1);
      expect(result.slack!.messages[0]).toEqual({
        id: '1704617400.123456',
        text: 'Hello team, great work!',
        user: 'U123',
        channel: 'C123',
        ts: '1704617400.123456',
        permalink: 'https://example.slack.com/archives/C123/p1704617400',
        type: 'message',
      });
    });

    it('複数ソースのFactsを統合する（Backlog + Slack + Calendar）', () => {
      const facts: Fact[] = [
        {
          id: 'fact-1',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-05T10:00:00Z',
          summary: 'Issue: PROJ-123',
          url: 'https://example.backlog.com/view/PROJ-123',
          confidence: 1.0,
          score: 0.8,
          rawRef: JSON.stringify({
            id: 'issue-123',
            key: 'PROJ-123',
            title: 'Fix bug',
            type: 'bug',
            status: 'Done',
            project: 'Project',
            url: 'https://example.backlog.com/view/PROJ-123',
            updatedAt: '2025-01-05T10:00:00Z',
          }),
          createdAt: '2025-01-05T10:00:00Z',
        },
        {
          id: 'fact-2',
          jobId: 'job-1',
          source: 'slack',
          occurredAt: '2025-01-06T11:00:00Z',
          summary: '#general: Message',
          url: 'https://slack.example.com/message',
          confidence: 1.0,
          score: 0.5,
          rawRef: JSON.stringify({
            id: 'msg-1',
            text: 'Test message',
            user: 'U123',
            channel: 'C123',
            ts: '1704617400',
            type: 'message',
          }),
          createdAt: '2025-01-06T11:00:00Z',
        },
        {
          id: 'fact-3',
          jobId: 'job-1',
          source: 'calendar',
          occurredAt: '2025-01-07T14:00:00Z',
          summary: '1on1 meeting',
          url: 'https://calendar.google.com/event?eid=abc123',
          confidence: 1.0,
          score: 1.0,
          rawRef: JSON.stringify({
            id: 'event-1',
            summary: '1on1 with Manager',
            start: '2025-01-07T14:00:00Z',
            end: '2025-01-07T15:00:00Z',
            durationMinutes: 60,
            status: 'confirmed',
            eventType: 'one-on-one',
          }),
          createdAt: '2025-01-07T14:00:00Z',
        },
        {
          id: 'fact-4',
          jobId: 'job-1',
          source: 'calendar',
          occurredAt: '2025-01-07T00:00:00Z',
          summary: 'Meeting Statistics',
          url: 'calendar://stats',
          confidence: 1.0,
          score: 1.0,
          rawRef: JSON.stringify({
            _type: 'stats',
            totalEvents: 10,
            totalMeetingMinutes: 300,
            meetingCount: 5,
            oneOnOneCount: 2,
            focusTimeMinutes: 120,
            averageMeetingDuration: 60,
            busiestDay: '2025-01-07',
          }),
          createdAt: '2025-01-07T00:00:00Z',
        },
      ];

      const result = transformer.transformToAgendaInput(member, period, facts);

      // Backlog
      expect(result.backlog.issues).toHaveLength(1);
      expect(result.backlog.pullRequests).toHaveLength(0);

      // Slack
      expect(result.slack).toBeDefined();
      expect(result.slack!.messages).toHaveLength(1);

      // Calendar
      expect(result.calendar).toBeDefined();
      expect(result.calendar!.events).toHaveLength(1);
      expect(result.calendar!.events[0].summary).toBe('1on1 with Manager');
      expect(result.calendar!.stats).toEqual({
        totalEvents: 10,
        totalMeetingMinutes: 300,
        meetingCount: 5,
        oneOnOneCount: 2,
        focusTimeMinutes: 120,
        averageMeetingDuration: 60,
        busiestDay: '2025-01-07',
      });
    });

    it('無効なrawRefデータを無視してエラーにしない', () => {
      const facts: Fact[] = [
        {
          id: 'fact-1',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-05T10:00:00Z',
          summary: 'Valid issue',
          url: 'https://example.backlog.com/view/PROJ-123',
          confidence: 1.0,
          score: 0.8,
          rawRef: JSON.stringify({
            id: 'issue-123',
            key: 'PROJ-123',
            title: 'Valid issue',
            type: 'bug',
            status: 'Done',
            project: 'Project',
            url: 'https://example.backlog.com/view/PROJ-123',
            updatedAt: '2025-01-05T10:00:00Z',
          }),
          createdAt: '2025-01-05T10:00:00Z',
        },
        {
          id: 'fact-2',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-06T10:00:00Z',
          summary: 'Invalid JSON',
          url: 'https://example.backlog.com/view/PROJ-999',
          confidence: 1.0,
          score: 0.8,
          rawRef: 'not a valid JSON',
          createdAt: '2025-01-06T10:00:00Z',
        },
      ];

      const result = transformer.transformToAgendaInput(member, period, facts);

      // 有効なFactのみが含まれる
      expect(result.backlog.issues).toHaveLength(1);
      expect(result.backlog.issues[0].key).toBe('PROJ-123');
    });

    it('rawRefにkeyフィールドがあればissue、numberフィールドがあればpullRequestとして分類する', () => {
      const facts: Fact[] = [
        {
          id: 'fact-1',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-05T10:00:00Z',
          summary: 'Issue',
          url: 'https://example.backlog.com/view/PROJ-123',
          confidence: 1.0,
          score: 0.8,
          rawRef: JSON.stringify({
            id: 'issue-123',
            key: 'PROJ-123',
            title: 'Issue',
            type: 'task',
            status: 'Open',
            project: 'Project',
            url: 'https://example.backlog.com/view/PROJ-123',
            updatedAt: '2025-01-05T10:00:00Z',
          }),
          createdAt: '2025-01-05T10:00:00Z',
        },
        {
          id: 'fact-2',
          jobId: 'job-1',
          source: 'backlog',
          occurredAt: '2025-01-06T10:00:00Z',
          summary: 'PR',
          url: 'https://example.backlog.com/pr/1',
          confidence: 1.0,
          score: 0.9,
          rawRef: JSON.stringify({
            number: 1,
            title: 'PR',
            description: 'Description',
            status: 'Open',
            projectId: 'proj-1',
            repositoryId: 'repo-1',
            repositoryName: 'repo',
            url: 'https://example.backlog.com/pr/1',
            createdAt: '2025-01-06T10:00:00Z',
            updatedAt: '2025-01-06T10:00:00Z',
          }),
          createdAt: '2025-01-06T10:00:00Z',
        },
      ];

      const result = transformer.transformToAgendaInput(member, period, facts);

      expect(result.backlog.issues).toHaveLength(1);
      expect(result.backlog.issues[0].key).toBe('PROJ-123');
      expect(result.backlog.pullRequests).toHaveLength(1);
      expect(result.backlog.pullRequests[0].number).toBe(1);
    });
  });
});
