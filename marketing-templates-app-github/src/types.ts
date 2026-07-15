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
}

export interface TeamMember {
  name: string;
  roleUa: string;
  roleEn: string;
  avatarColor: string;
}

export type ZoomLevel = 'days' | 'weeks' | 'months';
export type ActiveTab = 'plans' | 'gantt' | 'grid' | 'kanban' | 'workload';
export type Language = 'uk' | 'en';
