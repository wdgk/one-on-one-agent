/**
 * Backlog API のレスポンス型定義
 */

/**
 * Backlog API のユーザー情報
 */
export interface BacklogApiUser {
  id: number;
  userId?: string;
  name: string;
  roleType: number;
  lang?: string;
  mailAddress?: string;
}

/**
 * Backlog API の課題タイプ
 */
export interface BacklogApiIssueType {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
}

/**
 * Backlog API のステータス
 */
export interface BacklogApiStatus {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
}

/**
 * Backlog API の優先度
 */
export interface BacklogApiPriority {
  id: number;
  name: string;
}

/**
 * Backlog API の課題情報
 */
export interface BacklogApiIssue {
  id: number;
  projectId: number;
  issueKey: string;
  keyId: number;
  issueType: BacklogApiIssueType;
  summary: string;
  description?: string;
  resolution?: {
    id: number;
    name: string;
  };
  priority: BacklogApiPriority;
  status: BacklogApiStatus;
  assignee?: BacklogApiUser;
  category?: Array<{
    id: number;
    name: string;
    displayOrder: number;
  }>;
  versions?: Array<{
    id: number;
    projectId: number;
    name: string;
    description?: string;
    startDate?: string;
    releaseDueDate?: string;
    archived: boolean;
    displayOrder: number;
  }>;
  milestone?: Array<{
    id: number;
    projectId: number;
    name: string;
    description?: string;
    startDate?: string;
    releaseDueDate?: string;
    archived: boolean;
    displayOrder: number;
  }>;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  parentIssueId?: number;
  createdUser: BacklogApiUser;
  created: string;
  updatedUser: BacklogApiUser;
  updated: string;
  customFields?: Array<{
    id: number;
    fieldTypeId: number;
    name: string;
    value?: any;
  }>;
  attachments?: Array<{
    id: number;
    name: string;
    size: number;
    createdUser: BacklogApiUser;
    created: string;
  }>;
  sharedFiles?: Array<{
    id: number;
    type: string;
    dir: string;
    name: string;
    size: number;
    createdUser: BacklogApiUser;
    created: string;
    updatedUser: BacklogApiUser;
    updated: string;
  }>;
  stars?: Array<{
    id: number;
    comment?: string;
    url: string;
    title: string;
    presenter: BacklogApiUser;
    created: string;
  }>;
}

/**
 * Backlog API のプルリクエスト情報
 */
export interface BacklogApiPullRequest {
  id: number;
  projectId: number;
  repositoryId: number;
  number: number;
  summary: string;
  description: string;
  base: string;
  branch: string;
  status: {
    id: number;
    name: string;
  };
  assignee?: BacklogApiUser;
  issue?: {
    id: number;
    keyId: number;
    key: string;
    summary: string;
  };
  baseCommit?: string;
  branchCommit?: string;
  closedAt?: string;
  mergedAt?: string;
  createdUser: BacklogApiUser;
  created: string;
  updatedUser: BacklogApiUser;
  updated: string;
}
