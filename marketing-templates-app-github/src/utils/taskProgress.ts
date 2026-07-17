import type { SubTask, Task } from '../types';

const STATUS_PROGRESS: Record<Task['status'], number> = {
  todo: 0,
  in_progress: 50,
  in_review: 75,
  done: 100,
};

export const isSubtaskCompleted = (subtask: SubTask): boolean =>
  subtask.status ? subtask.status === 'done' : subtask.completed;

export const getAutomaticTaskProgress = (task: Task): number => {
  if (task.isMilestone) return 0;

  const subtasks = task.subtasks ?? [];
  if (subtasks.length > 0) {
    const completedCount = subtasks.filter(isSubtaskCompleted).length;
    return Math.round((completedCount / subtasks.length) * 100);
  }

  return STATUS_PROGRESS[task.status];
};

export const withAutomaticTaskProgress = (task: Task): Task => ({
  ...task,
  progress: getAutomaticTaskProgress(task),
});

export const normalizeTaskProgress = (tasks: Task[]): Task[] =>
  tasks.map(withAutomaticTaskProgress);
