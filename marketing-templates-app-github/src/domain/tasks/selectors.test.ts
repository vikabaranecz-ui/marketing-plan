import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { selectActiveTodayTasks, selectDueTodayTasks, selectOverdueTasks, selectUpcomingTasks } from './selectors';

const today = '2026-09-08';
const item = (startDate: string, endDate: string, status: Task['status'] = 'todo') => ({
  task: { id: `${startDate}-${endDate}-${status}`, title: 'Task', description: '', assignee: '', progress: 0, subtasks: [], comments: [], isMilestone: false, startDate, endDate, status },
});

describe('task date selectors', () => {
  it('treats a one-day task as due and active today', () => {
    const tasks = [item(today, today)];
    expect(selectDueTodayTasks(tasks, today)).toHaveLength(1);
    expect(selectActiveTodayTasks(tasks, today)).toHaveLength(1);
  });
  it('does not call a multi-day task due today', () => {
    const tasks = [item(today, '2026-09-09')];
    expect(selectDueTodayTasks(tasks, today)).toHaveLength(0);
    expect(selectActiveTodayTasks(tasks, today)).toHaveLength(1);
  });
  it('moves changed dates between upcoming, due, and overdue immediately', () => {
    expect(selectUpcomingTasks([item('2026-09-09', '2026-09-09')], today)).toHaveLength(1);
    expect(selectDueTodayTasks([item(today, today)], today)).toHaveLength(1);
    expect(selectOverdueTasks([item('2026-09-07', '2026-09-07')], today)).toHaveLength(1);
  });
  it('excludes completed tasks from every actionable group', () => {
    const tasks = [item('2026-09-07', today, 'done')];
    expect(selectDueTodayTasks(tasks, today)).toHaveLength(0);
    expect(selectActiveTodayTasks(tasks, today)).toHaveLength(0);
    expect(selectOverdueTasks(tasks, today)).toHaveLength(0);
  });
});
