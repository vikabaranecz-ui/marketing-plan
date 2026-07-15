import { useMemo, useState, type FormEvent } from 'react';
import { Archive, ArrowRight, CalendarDays, Lightbulb, Plus, Trash2, X } from 'lucide-react';
import type { Idea, Language } from '../types';

interface IdeasDialogProps {
  ideas: Idea[];
  plans: Array<{ id: string; title: string }>;
  lang: Language;
  onClose: () => void;
  onCreate: (idea: Pick<Idea, 'title' | 'description' | 'planId' | 'reviewAt' | 'reviewIntervalDays'>) => void;
  onArchive: (ideaId: string) => void;
  onDelete: (ideaId: string) => void;
  onConvert: (ideaId: string) => void;
}

export default function IdeasDialog({ ideas, plans, lang, onClose, onCreate, onArchive, onDelete, onConvert }: IdeasDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [planId, setPlanId] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [reviewIntervalDays, setReviewIntervalDays] = useState(0);
  const activeIdeas = useMemo(() => ideas
    .filter(idea => idea.status !== 'archived')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [ideas]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const reviewAt = reviewDate ? new Date(`${reviewDate}T09:00:00`).toISOString() : undefined;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      planId: planId || undefined,
      reviewAt,
      reviewIntervalDays: reviewDate && reviewIntervalDays > 0 ? reviewIntervalDays : undefined,
    });
    setTitle('');
    setDescription('');
    setPlanId('');
    setReviewDate('');
    setReviewIntervalDays(0);
  };

  const getPlanTitle = (idea: Idea) => plans.find(plan => plan.id === idea.planId)?.title;

  return (
    <>
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'} />
      <section className="dialog-container ideas-dialog" role="dialog" aria-modal="true" aria-labelledby="ideas-dialog-title">
        <header className="feature-dialog-header">
          <div>
            <span className="feature-dialog-icon ideas-icon"><Lightbulb size={19} /></span>
            <div>
              <h2 id="ideas-dialog-title">{lang === 'uk' ? 'Сховище ідей' : 'Idea inbox'}</h2>
              <p>{lang === 'uk' ? 'Записуйте думки зараз і перетворюйте їх на плани пізніше.' : 'Capture thoughts now and turn them into plans later.'}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'}><X size={17} /></button>
        </header>

        <form className="idea-create-form" onSubmit={handleSubmit}>
          <input className="form-control idea-title-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={lang === 'uk' ? 'Коротка назва ідеї' : 'Short idea title'} required />
          <textarea className="form-control idea-description-input" value={description} onChange={event => setDescription(event.target.value)} placeholder={lang === 'uk' ? 'Опишіть ідею, контекст або наступний крок…' : 'Describe the idea, context or next step…'} />
          <div className="idea-form-options">
            <label>
              <span>{lang === 'uk' ? 'Пов’язати з планом' : 'Link to plan'}</span>
              <select className="form-control" value={planId} onChange={event => setPlanId(event.target.value)}>
                <option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>
                {plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}
              </select>
            </label>
            <label>
              <span>{lang === 'uk' ? 'Повернутися до ідеї' : 'Review on'}</span>
              <input className="form-control" type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} />
            </label>
            <label>
              <span>{lang === 'uk' ? 'Повторювати' : 'Repeat'}</span>
              <select className="form-control" value={reviewIntervalDays} onChange={event => setReviewIntervalDays(Number(event.target.value))} disabled={!reviewDate}>
                <option value={0}>{lang === 'uk' ? 'Один раз' : 'Once'}</option>
                <option value={7}>{lang === 'uk' ? 'Щотижня' : 'Weekly'}</option>
                <option value={14}>{lang === 'uk' ? 'Раз на 2 тижні' : 'Every 2 weeks'}</option>
                <option value={30}>{lang === 'uk' ? 'Кожні 30 днів' : 'Every 30 days'}</option>
              </select>
            </label>
          </div>
          <button className="btn btn-primary idea-save-button"><Plus size={16} />{lang === 'uk' ? 'Зберегти ідею' : 'Save idea'}</button>
        </form>

        <div className="feature-list-header">
          <span>{lang === 'uk' ? 'Ваші ідеї' : 'Your ideas'}</span>
          <strong>{activeIdeas.length}</strong>
        </div>
        <div className="ideas-list">
          {activeIdeas.map(idea => (
            <article className={`idea-card idea-${idea.status}`} key={idea.id}>
              <div className="idea-card-heading">
                <span className="idea-bulb"><Lightbulb size={16} /></span>
                <span>
                  <strong>{idea.title}</strong>
                  <small>{getPlanTitle(idea) || (lang === 'uk' ? 'Загальна ідея' : 'General idea')}</small>
                </span>
                {idea.status === 'converted' && <i>{lang === 'uk' ? 'Стала планом' : 'Converted'}</i>}
              </div>
              {idea.description && <p>{idea.description}</p>}
              {idea.reviewAt && <time><CalendarDays size={13} />{lang === 'uk' ? 'Повернутися' : 'Review'}: {new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', { dateStyle: 'medium' }).format(new Date(idea.reviewAt))}{idea.reviewIntervalDays ? ` · ${lang === 'uk' ? `кожні ${idea.reviewIntervalDays} дн.` : `every ${idea.reviewIntervalDays} days`}` : ''}</time>}
              <div className="idea-card-actions">
                {idea.status !== 'converted' && <button className="btn btn-primary" onClick={() => onConvert(idea.id)}><ArrowRight size={15} />{lang === 'uk' ? 'Створити план' : 'Create plan'}</button>}
                <button className="btn btn-secondary" onClick={() => onArchive(idea.id)}><Archive size={15} /><span>{lang === 'uk' ? 'Архів' : 'Archive'}</span></button>
                <button className="btn-icon danger-icon" onClick={() => onDelete(idea.id)} aria-label={lang === 'uk' ? 'Видалити ідею' : 'Delete idea'}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
          {activeIdeas.length === 0 && <div className="feature-empty-state"><Lightbulb size={22} /><span>{lang === 'uk' ? 'Запишіть першу ідею — навіть якщо вона ще не належить до жодного плану.' : 'Capture your first idea, even if it does not belong to a plan yet.'}</span></div>}
        </div>
      </section>
    </>
  );
}
