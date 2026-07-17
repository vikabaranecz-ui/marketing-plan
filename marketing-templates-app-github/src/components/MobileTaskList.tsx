import { CalendarDays, CheckSquare, ChevronRight, Plus, UserRound } from 'lucide-react';
import type { Language, Task, TeamMember } from '../types';
import { getTranslation } from '../utils/locales';
import { getAutomaticTaskProgress, isSubtaskCompleted } from '../utils/taskProgress';

interface MobileTaskListProps {
  tasks: Task[];
  lang: Language;
  teamMembers: TeamMember[];
  onAdd: () => void;
  onOpen: (taskId: string) => void;
  onUpdate: (task: Task) => void;
}

export default function MobileTaskList({ tasks, lang, teamMembers, onAdd, onOpen, onUpdate }: MobileTaskListProps) {
  const doneCount = tasks.filter(task => task.status === 'done').length;

  return (
    <section className="mobile-task-screen">
      <div className="mobile-screen-intro">
        <div>
          <span>{lang === 'uk' ? 'Завдання плану' : 'Plan tasks'}</span>
          <h1>{lang === 'uk' ? 'Мої завдання' : 'My tasks'}</h1>
          <p>{lang === 'uk' ? `${doneCount} з ${tasks.length} виконано` : `${doneCount} of ${tasks.length} completed`}</p>
        </div>
        <button className="mobile-primary-action" onClick={onAdd}>
          <Plus size={18} />
          {lang === 'uk' ? 'Нове' : 'New'}
        </button>
      </div>

      <div className="mobile-task-list">
        {tasks.map(task => {
          const member = teamMembers.find(item => item.name === task.assignee);
          const completedSubtasks = task.subtasks.filter(isSubtaskCompleted).length;
          const progress = getAutomaticTaskProgress(task);
          return (
            <article className={`mobile-task-card ${task.status === 'done' ? 'done' : ''}`} key={task.id}>
              <span className="mobile-task-accent" style={{ background: task.color ?? '#6366f1' }} />
              <button className="mobile-task-main" onClick={() => onOpen(task.id)}>
                <span className="mobile-task-title-row">
                  <strong>{task.title}</strong>
                  <ChevronRight size={17} />
                </span>
                <span className="mobile-task-meta">
                  <span><CalendarDays size={13} />{task.startDate} — {task.endDate}</span>
                  <span>
                    <i style={{ background: member?.avatarColor ?? '#94a3b8' }} />
                    {task.assignee || (lang === 'uk' ? 'Без виконавця' : 'Unassigned')}
                  </span>
                  {task.subtasks.length > 0 && (
                    <span><CheckSquare size={13} />{completedSubtasks}/{task.subtasks.length}</span>
                  )}
                </span>
              </button>
              <div className="mobile-task-quick-edit">
                <select
                  value={task.status}
                  onChange={event => {
                    const status = event.target.value as Task['status'];
                    onUpdate({
                      ...task,
                      status,
                    });
                  }}
                  aria-label={lang === 'uk' ? 'Статус завдання' : 'Task status'}
                >
                  <option value="todo">{getTranslation(lang, 'todo')}</option>
                  <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                  <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                  <option value="done">{getTranslation(lang, 'done')}</option>
                </select>
                <span className="mobile-task-progress-value">{progress}%</span>
                {!task.isMilestone && (
                  <span className="mobile-task-progress-track" aria-label={`${getTranslation(lang, 'progress')}: ${progress}%`}>
                    <i style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : (task.color ?? 'var(--primary)') }} />
                  </span>
                )}
              </div>
            </article>
          );
        })}

        {tasks.length === 0 && (
          <div className="mobile-empty-state">
            <UserRound size={26} />
            <strong>{lang === 'uk' ? 'Завдань ще немає' : 'No tasks yet'}</strong>
            <p>{lang === 'uk' ? 'Створіть перше завдання для цього плану.' : 'Create the first task for this plan.'}</p>
            <button className="btn btn-primary" onClick={onAdd}><Plus size={16} />{lang === 'uk' ? 'Додати завдання' : 'Add task'}</button>
          </div>
        )}
      </div>
    </section>
  );
}
