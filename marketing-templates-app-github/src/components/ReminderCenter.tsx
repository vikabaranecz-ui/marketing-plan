import { useMemo, useState, type FormEvent } from 'react';
import { Bell, BellRing, CalendarClock, Clock3, Plus, Smartphone, Trash2, Volume2, X } from 'lucide-react';
import type { Language, Reminder, ReminderTargetType } from '../types';
import type { PushNotificationStatus } from '../lib/pushNotifications';

export interface ReminderPlanOption {
  id: string;
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    subtasks: Array<{ id: string; title: string }>;
  }>;
}

export interface ReminderTargetDraft {
  targetType: Exclude<ReminderTargetType, 'idea'>;
  planId: string;
  taskId?: string;
  subtaskId?: string;
}

interface ReminderCenterProps {
  reminders: Reminder[];
  plans: ReminderPlanOption[];
  defaultTarget: ReminderTargetDraft;
  lang: Language;
  onClose: () => void;
  onCreate: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
  onDelete: (reminderId: string) => void;
  onTestSound: () => void;
  pushStatus: PushNotificationStatus;
  getTargetLabel: (reminder: Reminder) => string;
}

const toLocalInputValue = (date: Date) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
};

const defaultReminderTime = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toLocalInputValue(date);
};

export default function ReminderCenter({
  reminders,
  plans,
  defaultTarget,
  lang,
  onClose,
  onCreate,
  onDelete,
  onTestSound,
  pushStatus,
  getTargetLabel,
}: ReminderCenterProps) {
  const [targetType, setTargetType] = useState(defaultTarget.targetType);
  const [planId, setPlanId] = useState(defaultTarget.planId || plans[0]?.id || '');
  const [taskId, setTaskId] = useState(defaultTarget.taskId || '');
  const [subtaskId, setSubtaskId] = useState(defaultTarget.subtaskId || '');
  const [remindAt, setRemindAt] = useState(defaultReminderTime);
  const [note, setNote] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'create'>(() =>
    reminders.some(reminder => !reminder.dismissedAt) ? 'list' : 'create'
  );

  const selectedPlan = plans.find(plan => plan.id === planId);
  const selectedTask = selectedPlan?.tasks.find(task => task.id === taskId);
  const activeReminders = useMemo(() => reminders
    .filter(reminder => !reminder.dismissedAt)
    .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt)), [reminders]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const plan = plans.find(item => item.id === planId);
    const task = plan?.tasks.find(item => item.id === taskId);
    const subtask = task?.subtasks.find(item => item.id === subtaskId);
    if (!plan || !remindAt) return;
    if (targetType === 'task' && !task) return;
    if (targetType === 'subtask' && (!task || !subtask)) return;

    const targetTitle = targetType === 'plan' ? plan.title : targetType === 'task' ? task?.title : subtask?.title;
    onCreate({
      targetType,
      planId,
      taskId: targetType === 'plan' ? undefined : taskId,
      subtaskId: targetType === 'subtask' ? subtaskId : undefined,
      title: targetTitle || (lang === 'uk' ? 'Нагадування' : 'Reminder'),
      note: note.trim() || undefined,
      remindAt: new Date(remindAt).toISOString(),
    });
    setNote('');
    setRemindAt(defaultReminderTime());
    setActiveView('list');
  };

  const formatDateTime = (value: string) => new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  return (
    <>
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'} />
      <section className="dialog-container reminder-center-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-center-title">
        <header className="feature-dialog-header">
          <div>
            <span className="feature-dialog-icon"><Bell size={19} /></span>
            <div>
              <h2 id="reminder-center-title">{lang === 'uk' ? 'Нагадування' : 'Reminders'}</h2>
              <p>{lang === 'uk' ? 'Оберіть план, завдання або підзавдання та точний час.' : 'Choose a plan, task or subtask and an exact time.'}</p>
            </div>
          </div>
          <div className="feature-dialog-actions">
            <button className="btn btn-secondary btn-compact reminder-sound-test" type="button" onClick={onTestSound}>
              <Volume2 size={15} /><span>{lang === 'uk' ? 'Перевірити звук' : 'Test sound'}</span>
            </button>
            <button className="btn-icon" type="button" onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'}><X size={17} /></button>
          </div>
        </header>

        <div className={`push-delivery-card ${pushStatus === 'enabled' ? 'enabled' : ''}`}>
          <span className="push-delivery-icon">{pushStatus === 'enabled' ? <BellRing size={20} /> : <Smartphone size={20} />}</span>
          <span className="push-delivery-copy">
            <strong>{lang === 'uk' ? 'Нагадування безпосередньо на телефон' : 'Reminders directly on your phone'}</strong>
            <small>
              {lang === 'uk'
                ? pushStatus === 'enabled' ? 'Дозвіл збережено — надсилання завжди автоматичне, навіть коли додаток закритий.'
                  : pushStatus === 'denied' ? 'Сповіщення заблоковані в налаштуваннях телефона.'
                    : pushStatus === 'unsupported' ? 'На iPhone додайте застосунок на головний екран, а потім відкрийте його звідти.'
                      : pushStatus === 'loading' ? 'Перевіряємо системний дозвіл…'
                        : 'Під час створення першого нагадування дозвіл потрібно підтвердити лише один раз.'
                : pushStatus === 'enabled' ? 'Permission saved — delivery is always automatic, even when the app is closed.'
                  : pushStatus === 'denied' ? 'Notifications are blocked in your phone settings.'
                    : pushStatus === 'unsupported' ? 'On iPhone, add the app to your Home Screen and open it from there.'
                      : pushStatus === 'loading' ? 'Checking system permission…'
                        : 'When creating the first reminder, permission only needs to be confirmed once.'}
            </small>
          </span>
        </div>

        <div className="reminder-view-switch" role="tablist" aria-label={lang === 'uk' ? 'Розділи нагадувань' : 'Reminder sections'}>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'list'}
            className={activeView === 'list' ? 'active' : ''}
            onClick={() => setActiveView('list')}
          >
            <Bell size={15} />{lang === 'uk' ? 'Мої нагадування' : 'My reminders'}
            {activeReminders.length > 0 && <strong>{activeReminders.length}</strong>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'create'}
            className={activeView === 'create' ? 'active' : ''}
            onClick={() => setActiveView('create')}
          >
            <Plus size={15} />{lang === 'uk' ? 'Створити' : 'Create'}
          </button>
        </div>

        {activeView === 'create' && <form className="reminder-form" onSubmit={handleSubmit}>
          <div className="reminder-target-switch" role="group" aria-label={lang === 'uk' ? 'Тип нагадування' : 'Reminder type'}>
            {(['plan', 'task', 'subtask'] as const).map(type => (
              <button
                type="button"
                className={targetType === type ? 'active' : ''}
                onClick={() => {
                  setTargetType(type);
                  if (type === 'plan') {
                    setTaskId('');
                    setSubtaskId('');
                  }
                }}
                key={type}
              >
                {lang === 'uk'
                  ? type === 'plan' ? 'План' : type === 'task' ? 'Завдання' : 'Підзавдання'
                  : type === 'plan' ? 'Plan' : type === 'task' ? 'Task' : 'Subtask'}
              </button>
            ))}
          </div>

          <div className="reminder-form-grid">
            <label className="form-group">
              <span>{lang === 'uk' ? 'План' : 'Plan'}</span>
              <select
                className="form-control"
                value={planId}
                onChange={event => {
                  setPlanId(event.target.value);
                  setTaskId('');
                  setSubtaskId('');
                }}
                required
              >
                {plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}
              </select>
            </label>

            {targetType !== 'plan' && (
              <label className="form-group">
                <span>{lang === 'uk' ? 'Завдання' : 'Task'}</span>
                <select
                  className="form-control"
                  value={taskId}
                  onChange={event => {
                    setTaskId(event.target.value);
                    setSubtaskId('');
                  }}
                  required
                >
                  <option value="">{lang === 'uk' ? 'Оберіть завдання' : 'Choose a task'}</option>
                  {selectedPlan?.tasks.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}
                </select>
              </label>
            )}

            {targetType === 'subtask' && (
              <label className="form-group">
                <span>{lang === 'uk' ? 'Підзавдання' : 'Subtask'}</span>
                <select className="form-control" value={subtaskId} onChange={event => setSubtaskId(event.target.value)} required>
                  <option value="">{lang === 'uk' ? 'Оберіть підзавдання' : 'Choose a subtask'}</option>
                  {selectedTask?.subtasks.map(subtask => <option value={subtask.id} key={subtask.id}>{subtask.title}</option>)}
                </select>
              </label>
            )}

            <label className="form-group">
              <span>{lang === 'uk' ? 'Дата й час' : 'Date and time'}</span>
              <input className="form-control" type="datetime-local" value={remindAt} onChange={event => setRemindAt(event.target.value)} required />
            </label>
          </div>

          <label className="form-group">
            <span>{lang === 'uk' ? 'Нотатка — необов’язково' : 'Note — optional'}</span>
            <textarea className="form-control reminder-note" value={note} onChange={event => setNote(event.target.value)} placeholder={lang === 'uk' ? 'Що саме потрібно не забути?' : 'What should you remember?'} />
          </label>
          <button className="btn btn-primary reminder-create-button"><Plus size={16} />{lang === 'uk' ? 'Додати нагадування' : 'Add reminder'}</button>
        </form>}

        {activeView === 'list' && <div className="reminder-list-panel" role="tabpanel">
          <div className="feature-list-header">
            <span>{lang === 'uk' ? 'Заплановані' : 'Scheduled'}</span>
            <strong>{activeReminders.length}</strong>
          </div>
          <div className="reminder-list">
            {activeReminders.map(reminder => (
              <article className={`reminder-list-item ${Date.parse(reminder.remindAt) <= Date.now() ? 'overdue' : ''}`} key={reminder.id}>
                <span className="reminder-list-icon"><CalendarClock size={16} /></span>
                <span className="reminder-list-copy">
                  <strong>{reminder.title}</strong>
                  <small>{getTargetLabel(reminder)}</small>
                  {reminder.note && <small className="reminder-list-note">{reminder.note}</small>}
                  <time><Clock3 size={12} />{formatDateTime(reminder.remindAt)}</time>
                </span>
                <button
                  type="button"
                  className="btn-icon danger-icon reminder-delete-button"
                  onClick={() => onDelete(reminder.id)}
                  title={lang === 'uk' ? 'Видалити нагадування' : 'Delete reminder'}
                  aria-label={`${lang === 'uk' ? 'Видалити нагадування' : 'Delete reminder'}: ${reminder.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {activeReminders.length === 0 && (
              <div className="feature-empty-state">
                <Bell size={21} />
                <span>{lang === 'uk' ? 'Нагадувань ще немає' : 'No reminders yet'}</span>
                <button type="button" className="btn btn-primary btn-compact" onClick={() => setActiveView('create')}>
                  <Plus size={15} />{lang === 'uk' ? 'Створити нагадування' : 'Create reminder'}
                </button>
              </div>
            )}
          </div>
        </div>}
      </section>
    </>
  );
}
