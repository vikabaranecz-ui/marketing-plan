import { useState } from 'react';
import { Archive, CalendarRange, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import type { Language, Task, ZoomLevel } from '../types';

export interface PlanCalendarItem {
  id: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  progress: number;
  taskCount: number;
  color: string;
  tasks: Task[];
}

interface PlansCalendarViewProps {
  plans: PlanCalendarItem[];
  zoomLevel: ZoomLevel;
  lang: Language;
  onSelect: (id: string) => void;
  onTaskSelect: (planId: string, taskId: string) => void;
  onArchive: (id: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffDays = (start: Date, end: Date) =>
  Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / DAY_MS);

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
};

export default function PlansCalendarView({ plans, zoomLevel, lang, onSelect, onTaskSelect, onArchive }: PlansCalendarViewProps) {
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Set<string>>(new Set());

  const togglePlan = (planId: string) => {
    setCollapsedPlanIds(previous => {
      const next = new Set(previous);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  if (plans.length === 0) {
    return (
      <div className="plans-calendar-empty">
        <CalendarRange size={28} />
        <h2>{lang === 'uk' ? 'Немає активних планів' : 'No active plans'}</h2>
        <p>{lang === 'uk' ? 'Відновіть план з архіву або створіть новий.' : 'Restore a plan from the archive or create a new one.'}</p>
      </div>
    );
  }

  const rows = plans.flatMap(plan => [
    { kind: 'plan' as const, plan, id: `plan_${plan.id}`, title: plan.title, startDate: plan.startDate, endDate: plan.endDate, progress: plan.progress, color: plan.color },
    ...(!collapsedPlanIds.has(plan.id) ? plan.tasks.map(task => ({ kind: 'task' as const, plan, task, id: `task_${plan.id}_${task.id}`, title: task.title, startDate: task.startDate, endDate: task.endDate, progress: task.progress, color: task.color ?? plan.color })) : []),
  ]);
  const planDates = rows.flatMap(row => [parseDate(row.startDate), parseDate(row.endDate)]);
  const earliest = new Date(Math.min(...planDates.map(date => date.getTime())));
  const latest = new Date(Math.max(...planDates.map(date => date.getTime())));
  const timelineStart = zoomLevel === 'months'
    ? new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    : zoomLevel === 'weeks'
      ? startOfWeek(earliest)
      : addDays(earliest, -2);
  const timelineEnd = zoomLevel === 'months'
    ? new Date(latest.getFullYear(), latest.getMonth() + 1, 0)
    : addDays(latest, zoomLevel === 'weeks' ? 7 : 2);
  const totalDays = Math.max(1, diffDays(timelineStart, timelineEnd) + 1);
  const unitDays = zoomLevel === 'days' ? 1 : zoomLevel === 'weeks' ? 7 : 30;
  const cellWidth = zoomLevel === 'days' ? 42 : zoomLevel === 'weeks' ? 96 : 124;
  const unitCount = Math.ceil(totalDays / unitDays);
  const timelineWidth = unitCount * cellWidth;
  const pxPerDay = timelineWidth / totalDays;
  const formatter = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: zoomLevel === 'months' ? undefined : 'numeric',
    month: zoomLevel === 'days' ? 'short' : 'short',
    year: zoomLevel === 'months' ? 'numeric' : undefined,
  });

  return (
    <div className="plans-calendar-shell">
      <div className="plans-calendar-intro">
        <div>
          <p className="eyebrow">{lang === 'uk' ? 'Календар портфеля' : 'Portfolio calendar'}</p>
          <h1>{lang === 'uk' ? 'Усі плани в одному календарі' : 'All plans in one calendar'}</h1>
        </div>
        <span>{lang === 'uk' ? `${plans.length} активних планів` : `${plans.length} active plans`}</span>
      </div>

      <div className="plans-calendar-board">
        <div className="plans-calendar-sidebar">
          <div className="plans-calendar-sidebar-header">{lang === 'uk' ? 'План' : 'Plan'}</div>
          {rows.map(row => row.kind === 'plan' ? (
            <div className="plans-calendar-plan portfolio-gantt-plan-row" key={row.id}>
              <button className="portfolio-gantt-collapse" onClick={() => togglePlan(row.plan.id)} aria-label={collapsedPlanIds.has(row.plan.id) ? (lang === 'uk' ? 'Показати завдання' : 'Show tasks') : (lang === 'uk' ? 'Сховати завдання' : 'Hide tasks')}>
                {collapsedPlanIds.has(row.plan.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </button>
              <button className="plans-calendar-open portfolio-gantt-plan-open" onClick={() => onSelect(row.plan.id)}>
                <span className="plans-calendar-dot" style={{ background: row.plan.color }} />
                <span className="plans-calendar-plan-copy">
                  <strong>{row.plan.title}</strong>
                  <small>{row.plan.taskCount} {lang === 'uk' ? 'завдань' : 'tasks'} · {row.plan.progress}%</small>
                </span>
                <ChevronRight size={15} />
              </button>
              <button
                className="plans-calendar-archive"
                onClick={() => onArchive(row.plan.id)}
                title={lang === 'uk' ? 'Архівувати план' : 'Archive plan'}
                aria-label={`${lang === 'uk' ? 'Архівувати план' : 'Archive plan'}: ${row.plan.title}`}
              >
                <Archive size={14} />
              </button>
            </div>
          ) : (
            <button className="portfolio-gantt-task-row" onClick={() => onTaskSelect(row.plan.id, row.task.id)} key={row.id}>
              <ListTodo size={14} style={{ color: row.color }} />
              <span><strong>{row.task.title}</strong><small>{row.task.progress}% · {row.task.endDate}</small></span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>

        <div className="plans-calendar-timeline-scroll">
          <div className="plans-calendar-timeline" style={{ width: timelineWidth }}>
            <div className="plans-calendar-header">
              {Array.from({ length: unitCount }, (_, index) => {
                const date = addDays(timelineStart, index * unitDays);
                return (
                  <div className="plans-calendar-header-cell" style={{ width: cellWidth }} key={date.toISOString()}>
                    {formatter.format(date)}
                  </div>
                );
              })}
            </div>
            {rows.map(row => {
              const start = parseDate(row.startDate);
              const end = parseDate(row.endDate);
              const left = Math.max(0, diffDays(timelineStart, start) * pxPerDay);
              const width = Math.max(18, (diffDays(start, end) + 1) * pxPerDay);
              return (
                <div className={`plans-calendar-row ${row.kind === 'task' ? 'portfolio-gantt-task-timeline-row' : 'portfolio-gantt-plan-timeline-row'}`} key={row.id}>
                  <button
                    className={`plans-calendar-bar ${row.kind === 'task' ? 'portfolio-gantt-task-bar' : ''}`}
                    style={{ left, width, background: row.color }}
                    onClick={() => row.kind === 'plan' ? onSelect(row.plan.id) : onTaskSelect(row.plan.id, row.task.id)}
                    title={`${row.title}: ${row.startDate} — ${row.endDate}`}
                  >
                    <span style={{ width: `${row.progress}%` }} />
                    <strong>{row.title}</strong>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
