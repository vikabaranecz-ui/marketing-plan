import { AlarmClock, Check, Clock3 } from 'lucide-react';
import type { Language, Reminder } from '../types';

interface ReminderAlertProps {
  reminder: Reminder;
  targetLabel: string;
  lang: Language;
  onDone: () => void;
  onSnooze: (minutes: number) => void;
}

export default function ReminderAlert({ reminder, targetLabel, lang, onDone, onSnooze }: ReminderAlertProps) {
  const formatted = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(reminder.remindAt));

  return (
    <div className="reminder-alert-layer" role="dialog" aria-modal="true" aria-labelledby="reminder-alert-title">
      <section className="reminder-alert-card">
        <span className="reminder-alert-icon"><AlarmClock size={28} /></span>
        <span className="reminder-alert-eyebrow">{lang === 'uk' ? 'Час нагадування' : 'Reminder'}</span>
        <h2 id="reminder-alert-title">{reminder.title}</h2>
        <p className="reminder-alert-target">{targetLabel}</p>
        {reminder.note && <p className="reminder-alert-note">{reminder.note}</p>}
        <time><Clock3 size={14} />{formatted}</time>
        <div className="reminder-alert-actions">
          <button className="btn btn-secondary" onClick={() => onSnooze(15)}><Clock3 size={16} />{lang === 'uk' ? 'Через 15 хв' : 'In 15 min'}</button>
          <button className="btn btn-primary" onClick={onDone}><Check size={16} />{lang === 'uk' ? 'Готово' : 'Done'}</button>
        </div>
      </section>
    </div>
  );
}
