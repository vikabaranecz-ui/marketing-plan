import { useState } from 'react';
import { CalendarCheck, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, ListChecks } from 'lucide-react';
import type { Language, Task } from '../types';

export interface TodayItem {
  id: string;
  parentTaskId: string;
  title: string;
  assignee: string;
  status: Task['status'];
  isSubtask: boolean;
  startDate: string;
  endDate: string;
}

export interface TodayPlanGroup {
  id: string;
  title: string;
  color: string;
  items: TodayItem[];
}

interface TodayPanelProps {
  groups: TodayPlanGroup[];
  lang: Language;
  referenceDate: string;
  onOpenPlan: (planId: string) => void;
  onOpenTask: (planId: string, taskId: string) => void;
}

const statusLabels = {
  uk: {
    todo: 'Заплановано',
    in_progress: 'У роботі',
    in_review: 'На перевірці',
    done: 'Виконано',
  },
  en: {
    todo: 'To do',
    in_progress: 'In progress',
    in_review: 'In review',
    done: 'Done',
  },
};

const getDayDifference = (date: string, referenceDate: string) => {
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(date) - toUtcDay(referenceDate)) / 86_400_000);
};

const formatDate = (date: string, lang: Language) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day));
};

const getDeadlineLabel = (endDate: string, referenceDate: string, lang: Language) => {
  const difference = getDayDifference(endDate, referenceDate);
  const dateLabel = formatDate(endDate, lang);

  if (difference < 0) return lang === 'uk' ? `Прострочено · ${dateLabel}` : `Overdue · ${dateLabel}`;
  if (difference === 0) return lang === 'uk' ? `До сьогодні · ${dateLabel}` : `Due today · ${dateLabel}`;
  if (difference === 1) return lang === 'uk' ? `До завтра · ${dateLabel}` : `Due tomorrow · ${dateLabel}`;
  return lang === 'uk' ? `До ${dateLabel}` : `Due ${dateLabel}`;
};

export default function TodayPanel({ groups, lang, referenceDate, onOpenPlan, onOpenTask }: TodayPanelProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gantt_today_panel_open_v2');
      return saved === null ? false : JSON.parse(saved) === true;
    } catch {
      return false;
    }
  });
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const todayLabel = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const togglePanel = () => {
    setIsOpen(previous => {
      const next = !previous;
      try {
        localStorage.setItem('gantt_today_panel_open_v2', JSON.stringify(next));
      } catch {
        // The panel still works when browser storage is unavailable.
      }
      return next;
    });
  };

  return (
    <>
      {isOpen && <button type="button" className="today-panel-scrim" onClick={togglePanel} aria-label={lang === 'uk' ? 'Закрити плани на сьогодні' : 'Close today plans'} />}
      <aside className={`today-panel ${isOpen ? 'open' : 'collapsed'}`} aria-label={lang === 'uk' ? 'Плани на сьогодні' : 'Today plans'}>
        <button className="today-panel-toggle" onClick={togglePanel} aria-expanded={isOpen}>
          <span className="today-panel-icon"><CalendarCheck size={18} /></span>
          <span className="today-panel-heading">
            <strong>{lang === 'uk' ? 'Сьогодні' : 'Today'}</strong>
            <small>{isOpen ? todayLabel : (lang === 'uk' ? `${totalItems} актуальних` : `${totalItems} active`)}</small>
          </span>
          <span className="today-panel-count">{totalItems}</span>
          {isOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>

        {isOpen && (
          <div className="today-panel-content">
            {groups.length > 0 ? groups.map(group => (
              <section className="today-plan-group" key={group.id}>
                <button className="today-plan-header" onClick={() => onOpenPlan(group.id)}>
                  <span className="today-plan-color" style={{ background: group.color }} />
                  <strong>{group.title}</strong>
                  <span>{group.items.length}</span>
                  <ExternalLink size={13} />
                </button>
                <div className="today-item-list">
                  {group.items.map(item => (
                    <button
                      className={`today-item ${item.status === 'done' ? 'done' : ''}`}
                      onClick={() => onOpenTask(group.id, item.parentTaskId)}
                      key={`${group.id}-${item.parentTaskId}-${item.isSubtask ? 'subtask' : 'task'}-${item.id}`}
                    >
                      <span className="today-item-type">
                        {item.isSubtask ? <ListChecks size={14} /> : <CheckCircle2 size={14} />}
                      </span>
                      <span className="today-item-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.isSubtask ? (lang === 'uk' ? 'Підзавдання' : 'Subtask') : (lang === 'uk' ? 'Завдання' : 'Task')}
                          {' · '}{item.assignee || (lang === 'uk' ? 'Без виконавця' : 'Unassigned')}
                        </small>
                        <span className={`today-item-deadline ${item.endDate < referenceDate ? 'overdue' : ''}`}>
                          <CalendarClock size={12} />
                          {getDeadlineLabel(item.endDate, referenceDate, lang)}
                        </span>
                      </span>
                      <span className={`today-status today-status-${item.status}`}>{statusLabels[lang][item.status]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )) : (
              <div className="today-panel-empty">
                <CheckCircle2 size={24} />
                <strong>{lang === 'uk' ? 'На сьогодні нічого не заплановано' : 'Nothing scheduled for today'}</strong>
                <span>{lang === 'uk' ? 'Можна зосередитися на наступних кроках.' : 'You can focus on what comes next.'}</span>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
