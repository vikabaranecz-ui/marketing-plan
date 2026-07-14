import { Archive, CalendarRange, ChevronRight, Pencil, Plus } from 'lucide-react';
import type { Language } from '../types';
import type { PlanCalendarItem } from './PlansCalendarView';

interface MobilePlansViewProps {
  plans: PlanCalendarItem[];
  activePlanId: string;
  lang: Language;
  onAdd: () => void;
  onArchive: (planId: string) => void;
  onOpen: (planId: string) => void;
  onRename: (planId: string) => void;
}

export default function MobilePlansView({ plans, activePlanId, lang, onAdd, onArchive, onOpen, onRename }: MobilePlansViewProps) {
  return (
    <section className="mobile-plans-screen">
      <div className="mobile-screen-intro">
        <div>
          <span>{lang === 'uk' ? 'Робочий простір' : 'Workspace'}</span>
          <h1>{lang === 'uk' ? 'Мої плани' : 'My plans'}</h1>
          <p>{lang === 'uk' ? `${plans.length} активних планів` : `${plans.length} active plans`}</p>
        </div>
        <button className="mobile-primary-action" onClick={onAdd}>
          <Plus size={18} />
          {lang === 'uk' ? 'План' : 'Plan'}
        </button>
      </div>

      <div className="mobile-plan-cards">
        {plans.map(plan => (
          <article className={`mobile-plan-card ${plan.id === activePlanId ? 'active' : ''}`} key={plan.id}>
            <button className="mobile-plan-main" onClick={() => onOpen(plan.id)}>
              <span className="mobile-plan-icon" style={{ background: plan.color }}><CalendarRange size={18} /></span>
              <span className="mobile-plan-copy">
                <strong>{plan.title}</strong>
                <small>{plan.taskCount} {lang === 'uk' ? 'завдань' : 'tasks'} · {plan.startDate} — {plan.endDate}</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <div className="mobile-plan-progress">
              <span><i style={{ width: `${plan.progress}%`, background: plan.color }} /></span>
              <strong>{plan.progress}%</strong>
            </div>
            <div className="mobile-plan-actions">
              <button onClick={() => onRename(plan.id)}><Pencil size={14} />{lang === 'uk' ? 'Назва' : 'Rename'}</button>
              <button onClick={() => onArchive(plan.id)}><Archive size={14} />{lang === 'uk' ? 'Архів' : 'Archive'}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
