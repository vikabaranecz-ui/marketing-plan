import { Bot, CheckCircle2, ChevronRight, Search, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Language, WorkspaceNote } from '../types';
import type { GlobalTaskItem } from './AllTasksView';

interface AiAssistantProps {
  lang: Language;
  tasks: GlobalTaskItem[];
  notes: WorkspaceNote[];
  onOpenTask: (planId: string, taskId: string) => void;
  onCreateSteps: (planId: string, taskId: string) => void;
}

interface Answer { text: string; matches: GlobalTaskItem[] }

export default function AiAssistant({ lang, tasks, notes, onOpenTask, onCreateSteps }: AiAssistantProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const ask = (value = question) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) return;
    const words = normalized.split(/\s+/).filter(word => word.length > 2);
    let matches = tasks.filter(({ task, planTitle }) => words.some(word => `${task.title} ${task.description} ${task.assignee} ${planTitle}`.toLocaleLowerCase().includes(word)));
    if (/незаверш|невикон|unfinished|open/.test(normalized)) matches = tasks.filter(({ task }) => task.status !== 'done');
    if (/сьогодні|today/.test(normalized)) { const today = new Date().toISOString().slice(0, 10); matches = tasks.filter(({ task }) => task.startDate <= today && task.endDate >= today && task.status !== 'done'); }
    const matchingNotes = notes.filter(note => words.some(word => `${note.title} ${note.content}`.toLocaleLowerCase().includes(word)));
    const text = matches.length
      ? (lang === 'uk' ? `Знайшла ${matches.length} пов’язаних завдань${matchingNotes.length ? ` і ${matchingNotes.length} нотаток` : ''}. Відкрийте завдання або попросіть розкласти його на прості кроки.` : `I found ${matches.length} related tasks${matchingNotes.length ? ` and ${matchingNotes.length} notes` : ''}. Open a task or break it into simple steps.`)
      : (lang === 'uk' ? 'Точного збігу немає. Спробуйте назву плану, завдання, виконавця або запит «покажи незавершені». ' : 'No exact match. Try a plan, task, assignee, or “show unfinished”.');
    setAnswer({ text, matches: matches.slice(0, 8) });
    setQuestion('');
  };

  return <section className="ai-assistant-screen">
    <header className="ai-hero"><span><Sparkles size={16} />AI-помічник</span><h1>{lang === 'uk' ? 'Чим допомогти?' : 'How can I help?'}</h1><p>{lang === 'uk' ? 'Шукаю по ваших планах і нотатках та допомагаю перетворити складну справу на прості кроки.' : 'I search your plans and notes and turn complex work into simple steps.'}</p></header>
    <div className="ai-suggestions"><button onClick={() => ask(lang === 'uk' ? 'покажи незавершені завдання' : 'show unfinished tasks')}><CheckCircle2 />{lang === 'uk' ? 'Що ще не завершено?' : 'What is unfinished?'}</button><button onClick={() => ask(lang === 'uk' ? 'що робити сьогодні' : 'what should I do today')}><Search />{lang === 'uk' ? 'Що робити сьогодні?' : 'What should I do today?'}</button></div>
    <form className="ai-prompt" onSubmit={event => { event.preventDefault(); ask(); }}><Bot size={20} /><textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder={lang === 'uk' ? 'Наприклад: знайди завдання по рекламі…' : 'Example: find advertising tasks…'} /><button type="submit"><Send size={18} /></button></form>
    {answer && <div className="ai-answer"><p>{answer.text}</p><div>{answer.matches.map(({ planId, planTitle, planColor, task }) => <article key={`${planId}-${task.id}`}><i style={{ background: planColor }} /><span><small>{planTitle}</small><strong>{task.title}</strong></span><button onClick={() => onCreateSteps(planId, task.id)}><Sparkles size={14} />{lang === 'uk' ? 'Створити кроки' : 'Create steps'}</button><button onClick={() => onOpenTask(planId, task.id)} aria-label={lang === 'uk' ? 'Відкрити' : 'Open'}><ChevronRight /></button></article>)}</div></div>}
  </section>;
}
