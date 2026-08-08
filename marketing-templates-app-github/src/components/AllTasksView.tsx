import { CalendarDays, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { Language, Task } from '../types';
import { getTranslation } from '../utils/locales';
import { getAutomaticTaskProgress } from '../utils/taskProgress';

export interface GlobalTaskItem {
  planId: string;
  planTitle: string;
  planColor: string;
  task: Task;
}

interface AllTasksViewProps {
  items: GlobalTaskItem[];
  lang: Language;
  onOpen: (planId: string, taskId: string) => void;
}

export default function AllTasksView({ items, lang, onOpen }: AllTasksViewProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'open' | Task['status'] | 'all'>('open');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filtered = items.filter(({ task, planTitle }) => {
    const matchesQuery = !deferredQuery || `${task.title} ${task.description} ${task.assignee} ${planTitle}`.toLocaleLowerCase().includes(deferredQuery);
    const matchesStatus = status === 'all' || (status === 'open' ? task.status !== 'done' : task.status === status);
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="all-tasks-screen">
      <header className="simple-page-header">
        <div><span>{lang === 'uk' ? 'Усі плани разом' : 'Every plan together'}</span><h1>{lang === 'uk' ? 'Усі завдання' : 'All tasks'}</h1><p>{filtered.length} {lang === 'uk' ? 'завдань показано' : 'tasks shown'}</p></div>
      </header>
      <div className="all-tasks-controls">
        <label><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'uk' ? 'Знайти завдання або план…' : 'Find a task or plan…'} /></label>
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
          <option value="open">{lang === 'uk' ? 'Незавершені' : 'Unfinished'}</option>
          <option value="all">{lang === 'uk' ? 'Усі статуси' : 'All statuses'}</option>
          <option value="todo">{getTranslation(lang, 'todo')}</option>
          <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
          <option value="in_review">{getTranslation(lang, 'in_review')}</option>
          <option value="done">{getTranslation(lang, 'done')}</option>
        </select>
      </div>
      <div className="all-tasks-list">
        {filtered.map(({ planId, planTitle, planColor, task }) => {
          const progress = getAutomaticTaskProgress(task);
          return (
            <button className="all-task-card" onClick={() => onOpen(planId, task.id)} key={`${planId}-${task.id}`}>
              <i className="all-task-accent" style={{ background: planColor }} />
              <span className={`all-task-check ${task.status === 'done' ? 'done' : ''}`}>{task.status === 'done' ? <CheckCircle2 /> : progress}</span>
              <span className="all-task-copy"><small>{planTitle}</small><strong>{task.title}</strong><span><CalendarDays size={13} />{task.startDate} — {task.endDate}{task.assignee ? ` · ${task.assignee}` : ''}</span><i><b style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : planColor }} /></i></span>
              <span className={`all-task-status status-${task.status}`}>{getTranslation(lang, task.status)}</span>
              <ChevronRight size={18} />
            </button>
          );
        })}
        {filtered.length === 0 && <div className="simple-empty"><CheckCircle2 /><strong>{lang === 'uk' ? 'Тут поки порожньо' : 'Nothing here yet'}</strong></div>}
      </div>
    </section>
  );
}
