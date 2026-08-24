export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  assignee?: string;
  status?: 'todo' | 'in_progress' | 'in_review' | 'done';
}

export interface TaskComment {
  id: string;
  author: string;
  avatarColor: string;
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  progress: number;  // 0 to 100
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  assignee: string;
  dependencyTaskId?: string;
  isMilestone: boolean;
  color?: string; // Hex or theme color name
  subtasks: SubTask[];
  comments: TaskComment[];
  archived?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  campaignId?: string;
}

export interface MarketingTemplate {
  id: string;
  titleUa: string;
  titleEn: string;
  categoryUa: string;
  categoryEn: string;
  descriptionUa: string;
  descriptionEn: string;
  iconName: string;
  tasks: Task[];
  client?: string;
  owner?: string;
  startDate?: string;
  deadline?: string;
  status?: 'active' | 'completed' | 'archived';
}

export type ReminderTargetType = 'plan' | 'task' | 'subtask' | 'idea';

export interface Reminder {
  id: string;
  targetType: ReminderTargetType;
  planId?: string;
  taskId?: string;
  subtaskId?: string;
  ideaId?: string;
  title: string;
  note?: string;
  remindAt: string;
  createdAt: string;
  notifiedAt?: string;
  dismissedAt?: string;
}

export type IdeaStatus = 'inbox' | 'considering' | 'converted' | 'archived';

export interface Idea {
  id: string;
  title: string;
  description: string;
  planId?: string;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  reviewAt?: string;
  reviewIntervalDays?: number;
  convertedPlanId?: string;
  taskId?: string;
  tags?: string[];
  attachmentIds?: string[];
  clientId?: string;
  projectId?: string;
  campaignId?: string;
  contentId?: string;
}

export interface WorkspaceNote {
  id: string;
  title: string;
  content: string;
  notebookId?: string;
  planId?: string;
  taskId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNotebook {
  id: string;
  name: string;
  color: string;
  planId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocument {
  id: string;
  name: string;
  storagePath: string;
  mimeType: string;
  size: number;
  planId?: string;
  taskId?: string;
  notebookId?: string;
  noteId?: string;
  clientId?: string;
  campaignId?: string;
  contentId?: string;
  ideaId?: string;
  note?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignObjective = 'awareness' | 'traffic' | 'leads' | 'sales' | 'engagement' | 'retention';

export interface Campaign {
  id: string;
  name: string;
  clientId?: string;
  projectId?: string;
  objective: CampaignObjective;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';
  owner?: string;
  channels: string[];
  budget?: number;
  notes?: string;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; destinationUrl?: string };
  createdAt: string;
  updatedAt: string;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'youtube' | 'blog' | 'email' | 'other';
export type ContentFormat = 'reel' | 'story' | 'carousel' | 'static' | 'video' | 'short' | 'article' | 'email' | 'other';
export type ContentStatus = 'idea' | 'brief' | 'creating' | 'review' | 'ready' | 'scheduled' | 'published';

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  projectId?: string;
  campaignId?: string;
  sourceContentId?: string;
  sourceIdeaId?: string;
  platforms: SocialPlatform[];
  format: ContentFormat;
  funnelStage?: 'TOFU' | 'MOFU' | 'BOFU';
  objective?: CampaignObjective;
  pillar?: string;
  hook?: string;
  script?: string;
  caption?: string;
  cta?: string;
  status: ContentStatus;
  assignee?: string;
  publishAt?: string;
  postUrls?: { platform: SocialPlatform; url: string }[];
  tags?: string[];
  checklist?: { id: string; title: string; completed: boolean }[];
  comments?: TaskComment[];
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; destinationUrl?: string };
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsSource = 'ga4' | 'search_console' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'meta_ads' | 'google_ads' | 'manual';

export interface MetricPoint {
  id: string;
  source: AnalyticsSource;
  metric: string;
  value: number;
  date?: string;
  previousValue?: number;
  clientId?: string;
  contentId?: string;
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatform | 'ga4' | 'search_console' | 'google_ads' | 'meta_ads';
  accountName: string;
  externalAccountId?: string;
  clientId?: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  connectedAt?: string;
}

export interface TeamMember {
  name: string;
  roleUa: string;
  roleEn: string;
  avatarColor: string;
}

export type ZoomLevel = 'days' | 'weeks' | 'months';
export type ActiveTab = 'home' | 'plans' | 'all_tasks' | 'content' | 'analytics' | 'calendar' | 'ideas' | 'files' | 'settings' | 'gantt' | 'grid' | 'kanban' | 'workload' | 'notes' | 'assistant';
export type Language = 'uk' | 'en';
