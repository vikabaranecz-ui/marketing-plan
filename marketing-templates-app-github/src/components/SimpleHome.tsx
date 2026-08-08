import { Bot, CalendarDays, CheckCircle2, FileText, ListTodo, NotebookPen } from 'lucide-react';
import type { Language } from '../types';

interface HomeTask {
  id: string;
  planId: string;
  planTitle: string;
  title: string;
  endDate: string;
  color: string;
}

interface SimpleHomeProps {
  lang: Language;
  openTasks: HomeTask[];
  todayCount: number;
  notesCount: number;
  documentsCount: number;
  onOpenAllTasks: () => void;
  onOpenTask: (planId: string, taskId: string) => void;
  onOpenNotes: () => void;
  onOpenAssistant: () => void;
}

export default function SimpleHome({
  lang,
  openTasks,
  todayCount,
  notesCount,
  documentsCount,
  onOpenAllTasks,
  onOpenTask,
  onOpenNotes,
  onOpenAssistant,
}: SimpleHomeProps) {
  const today = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    <section className="simple-home">
      <header className="simple-home-hero">
        <span className="simple-home-date"><CalendarDays size={18} />{today}</span>
        <h1>{lang === 'uk' ? 'Що робимо сьогодні?' : 'What are we doing today?'}</h1>
        <p>{lang === 'uk' ? 'Усе важливе — простими кроками в одному місці.' : 'Everything important, in simple steps and one place.'}</p>
      </header>

      <div className="simple-home-actions">
        <button onClick={onOpenAllTasks}><span className="home-action-icon blue"><ListTodo /></span><strong>{lang === 'uk' ? 'Усі завдання' : 'All tasks'}</strong><small>{openTasks.length} {lang === 'uk' ? 'незавершених' : 'unfinished'}</small></button>
        <button onClick={onOpenAllTasks}><span className="home-action-icon green"><CheckCircle2 /></span><strong>{lang === 'uk' ? 'На сьогодні' : 'For today'}</strong><small>{todayCount} {lang === 'uk' ? 'актуальних' : 'active'}</small></button>
        <button onClick={onOpenNotes}><span className="home-action-icon violet"><NotebookPen /></span><strong>{lang === 'uk' ? 'Нотатки' : 'Notes'}</strong><small>{notesCount} {lang === 'uk' ? 'сторінок' : 'pages'}</small></button>
        <button onClick={onOpenNotes}><span className="home-action-icon orange"><FileText /></span><strong>{lang === 'uk' ? 'Документи' : 'Documents'}</strong><small>{documentsCount} PDF / scan</small></button>
        <button className="home-ai-action" onClick={onOpenAssistant}><span className="home-action-icon pink"><Bot /></span><strong>{lang === 'uk' ? 'Запитати AI' : 'Ask AI'}</strong><small>{lang === 'uk' ? 'Знайти або розкласти завдання на кроки' : 'Find or break a task into steps'}</small></button>
      </div>

      <section className="simple-next-section">
        <div className="simple-section-heading"><div><span>{lang === 'uk' ? 'Далі' : 'Next'}</span><h2>{lang === 'uk' ? 'Незавершені завдання' : 'Unfinished tasks'}</h2></div><button onClick={onOpenAllTasks}>{lang === 'uk' ? 'Показати всі' : 'Show all'}</button></div>
        <div className="simple-next-list">
          {openTasks.slice(0, 5).map(task => (
            <button key={`${task.planId}-${task.id}`} onClick={() => onOpenTask(task.planId, task.id)}>
              <i style={{ background: task.color }} />
              <span><strong>{task.title}</strong><small>{task.planTitle}</small></span>
              <time>{task.endDate}</time>
            </button>
          ))}
          {openTasks.length === 0 && <div className="simple-empty"><CheckCircle2 /><strong>{lang === 'uk' ? 'Усе виконано!' : 'Everything is done!'}</strong></div>}
        </div>
      </section>
    </section>
  );
}
