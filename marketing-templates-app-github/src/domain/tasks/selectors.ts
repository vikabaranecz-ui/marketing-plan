import type { Task } from '../../types';

export interface TaskRecord<TTask extends Task = Task> {
  task: TTask;
}

const open = <T extends TaskRecord>(item: T) => item.task.status !== 'done';

export const selectOverdueTasks = <T extends TaskRecord>(items: readonly T[], date: string) =>
  items.filter(item => open(item) && item.task.endDate < date);

export const selectDueTodayTasks = <T extends TaskRecord>(items: readonly T[], date: string) =>
  items.filter(item => open(item) && item.task.endDate === date);

export const selectActiveTodayTasks = <T extends TaskRecord>(items: readonly T[], date: string) =>
  items.filter(item => open(item) && item.task.startDate <= date && item.task.endDate >= date);

export const selectUpcomingTasks = <T extends TaskRecord>(items: readonly T[], date: string) =>
  items.filter(item => open(item) && item.task.startDate > date)
    .toSorted((a, b) => a.task.startDate.localeCompare(b.task.startDate));

export const selectTasksForDate = <T extends TaskRecord>(items: readonly T[], date: string) =>
  selectActiveTodayTasks(items, date);

export const selectProjectTasks = <T extends TaskRecord & { planId: string }>(items: readonly T[], projectId: string) =>
  items.filter(item => item.planId === projectId);
