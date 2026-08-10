import { useState, type CSSProperties } from 'react';
import { CalendarRange, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock3, ListTodo } from 'lucide-react';
import type { Language } from '../types';
import type { PlanCalendarItem } from './PlansCalendarView';

interface PortfolioBoardProps {
  plans: PlanCalendarItem[];
  lang: Language;
  onOpenPlan: (planId: string) => void;
  onOpenTask: (planId: string, taskId: string) => void;
}

type PortfolioStatus = 'planned' | 'active' | 'done';

const columns: { id: PortfolioStatus; titleUa: string; titleEn: string; color: string }[] = [
  { id: 'planned', titleUa: 'Не розпочато', titleEn: 'Not started', color: '#94a3b8' },
  { id: 'active', titleUa: 'У роботі', titleEn: 'In progress', color: '#6366f1' },
  { id: 'done', titleUa: 'Завершено', titleEn: 'Completed', color: '#10b981' },
];

const getPlanStatus = (plan: PlanCalendarItem): PortfolioStatus =>
  plan.progress >= 100 ? 'done' : plan.progress > 0 ? 'active' : 'planned';

export default function PortfolioBoard({ plans, lang, onOpenPlan, onOpenTask }: PortfolioBoardProps) {
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Set<string>>(new Set());

  const togglePlan = (planId: string) => {
    setCollapsedPlanIds(previous => {
      const next = new Set(previous);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  return (
    <section className="portfolio-board-shell">
      <div className="portfolio-view-heading">
        <div>
          <p className="eyebrow">{lang === 'uk' ? 'Board портфеля' : 'Portfolio board'}</p>
          <h1>{lang === 'uk' ? 'Плани та їхні завдання' : 'Plans and their tasks'}</h1>
        </div>
        <span>{lang === 'uk' ? `${plans.length} активних планів` : `${plans.length} active plans`}</span>
      </div>

      <div className="portfolio-board">
        {columns.map(column => {
          const columnPlans = plans.filter(plan => getPlanStatus(plan) === column.id);
          return (
            <section className="portfolio-board-column" key={column.id}>
              <header>
                <span><i style={{ background: column.color }} />{lang === 'uk' ? column.titleUa : column.titleEn}</span>
                <strong>{columnPlans.length}</strong>
              </header>

              <div className="portfolio-plan-list">
                {columnPlans.map(plan => {
                  const collapsed = collapsedPlanIds.has(plan.id);
                  return (
                    <article className="portfolio-plan-card" style={{ '--plan-color': plan.color } as CSSProperties} key={plan.id}>
                      <div className="portfolio-plan-card-head">
                        <button className="portfolio-plan-collapse" onClick={() => togglePlan(plan.id)} aria-label={collapsed ? (lang === 'uk' ? 'Показати завдання' : 'Show tasks') : (lang === 'uk' ? 'Сховати завдання' : 'Hide tasks')}>
                          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button className="portfolio-plan-title" onClick={() => onOpenPlan(plan.id)}>
                          <span style={{ background: plan.color }}><CalendarRange size={17} /></span>
                          <span><strong>{plan.title}</strong><small>{plan.taskCount} {lang === 'uk' ? 'завдань' : 'tasks'} · {plan.startDate} — {plan.endDate}</small></span>
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      <div className="portfolio-plan-progress"><span><i style={{ width: `${plan.progress}%`, background: plan.color }} /></span><strong>{plan.progress}%</strong></div>

                      {!collapsed && (
                        <div className="portfolio-plan-tasks">
                          {plan.tasks.map(task => (
                            <button onClick={() => onOpenTask(plan.id, task.id)} key={task.id}>
                              <span className={`portfolio-task-status status-${task.status}`}>
                                {task.status === 'done' ? <CheckCircle2 size={15} /> : task.status === 'in_progress' ? <Clock3 size={15} /> : <Circle size={15} />}
                              </span>
                              <span><strong>{task.title}</strong><small>{task.endDate} · {task.progress}%</small></span>
                              <ChevronRight size={15} />
                            </button>
                          ))}
                          {plan.tasks.length === 0 && <div className="portfolio-plan-empty"><ListTodo size={16} />{lang === 'uk' ? 'Завдань ще немає' : 'No tasks yet'}</div>}
                        </div>
                      )}
                    </article>
                  );
                })}

                {columnPlans.length === 0 && <div className="portfolio-column-empty">{lang === 'uk' ? 'Тут поки порожньо' : 'Nothing here yet'}</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
