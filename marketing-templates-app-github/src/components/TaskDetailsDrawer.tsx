import React, { useState } from 'react';
import type { Task, TaskComment, SubTask, Language, TeamMember, Reminder } from '../types';
import { getTranslation } from '../utils/locales';
import { X, Plus, Trash2, CheckSquare, MessageSquare, AlertTriangle, Send, Copy, Archive, Bell, PenLine } from 'lucide-react';
import HandwritingInputDialog from './HandwritingInputDialog';

interface TaskDetailsDrawerProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  tasks: Task[];
  lang: Language;
  teamMembers: TeamMember[];
  currentUserEmail: string;
  reminders: Reminder[];
  onAddReminder: (targetType: 'task' | 'subtask', subtaskId?: string) => void;
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDaysBetween = (d1: Date, d2: Date): number => {
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

export default function TaskDetailsDrawer({
  task,
  onClose,
  onUpdate,
  onClone,
  onDelete,
  onArchive,
  tasks,
  lang,
  teamMembers,
  currentUserEmail,
  reminders,
  onAddReminder,
}: TaskDetailsDrawerProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [handwritingEditor, setHandwritingEditor] = useState<{
    title: string;
    value: string;
    multiline?: boolean;
    onApply: (value: string) => void;
  } | null>(null);

  // Color palette options
  const colorOptions = [
    { value: '#6366f1', labelUa: 'Індиго', labelEn: 'Indigo' },
    { value: '#8b5cf6', labelUa: 'Фіолетовий', labelEn: 'Violet' },
    { value: '#ec4899', labelUa: 'Рожевий', labelEn: 'Pink' },
    { value: '#f59e0b', labelUa: 'Бурштиновий', labelEn: 'Amber' },
    { value: '#10b981', labelUa: 'Смарагдовий', labelEn: 'Emerald' },
    { value: '#06b6d4', labelUa: 'Блакитний', labelEn: 'Cyan' },
    { value: '#3b82f6', labelUa: 'Синій', labelEn: 'Blue' },
    { value: '#ef4444', labelUa: 'Червоний', labelEn: 'Red' }
  ];

  // Exclude current task from potential dependencies to prevent circular loops
  const eligiblePredecessors = tasks.filter(t => t.id !== task.id);

  // Field change updates
  const handleFieldChange = (key: keyof Task, value: any) => {
    onUpdate({
      ...task,
      [key]: value
    });
  };

  const handleStartDateChange = (newStartStr: string) => {
    if (!newStartStr) return;
    const oldStart = parseLocalDate(task.startDate);
    const oldEnd = parseLocalDate(task.endDate);
    const duration = getDaysBetween(oldStart, oldEnd);
    
    const newStart = parseLocalDate(newStartStr);
    const newEnd = addDays(newStart, duration);

    onUpdate({
      ...task,
      startDate: newStartStr,
      endDate: formatLocalDate(newEnd)
    });
  };

  const handleEndDateChange = (newEndStr: string) => {
    if (!newEndStr) return;
    const start = parseLocalDate(task.startDate);
    const newEnd = parseLocalDate(newEndStr);

    if (newEnd.getTime() >= start.getTime()) {
      onUpdate({
        ...task,
        endDate: newEndStr
      });
    }
  };

  const handleMilestoneToggle = (isMilestone: boolean) => {
    onUpdate({
      ...task,
      isMilestone,
      endDate: isMilestone ? task.startDate : task.endDate,
      progress: isMilestone ? 0 : task.progress
    });
  };

  // Subtasks logic
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSub: SubTask = {
      id: `sub_${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      status: 'todo',
    };

    handleFieldChange('subtasks', [...(task.subtasks || []), newSub]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    const updated = task.subtasks.map(s => 
      s.id === subId
        ? { ...s, completed: !s.completed, status: !s.completed ? 'done' as const : 'todo' as const }
        : s
    );
    handleFieldChange('subtasks', updated);
  };

  const handleDeleteSubtask = (subId: string) => {
    const updated = task.subtasks.filter(s => s.id !== subId);
    handleFieldChange('subtasks', updated);
  };

  // Comments logic
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;

    const commenterName = currentUserEmail || 'User';
    const member = teamMembers.find(m => m.name === commenterName || commenterName.startsWith(`${m.name}@`));
    const avatarColor = member ? member.avatarColor : '#6b7280';
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newComment: TaskComment = {
      id: `comment_${Date.now()}`,
      author: commenterName,
      avatarColor,
      content: newCommentContent.trim(),
      timestamp
    };

    handleFieldChange('comments', [...(task.comments || []), newComment]);
    setNewCommentContent('');
  };

  // Dependency validation warning
  let hasWarning = false;
  if (task.dependencyTaskId) {
    const pred = tasks.find(p => p.id === task.dependencyTaskId);
    if (pred && parseLocalDate(pred.endDate) > parseLocalDate(task.startDate)) {
      hasWarning = true;
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        
        {/* Header */}
        <div className="drawer-header">
          <h3>{getTranslation(lang, 'taskDetails')}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="drawer-content">
          {hasWarning && (
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--danger)',
              fontSize: '0.82rem',
              lineHeight: 1.4
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{getTranslation(lang, 'warningDependency')}</span>
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label>{getTranslation(lang, 'taskTitle')}</label>
            <div className="handwriting-field-row">
              <input
                type="text"
                className="form-control"
                value={task.title}
                onChange={e => handleFieldChange('title', e.target.value)}
              />
              <button type="button" className="handwriting-trigger" onClick={() => setHandwritingEditor({
                title: lang === 'uk' ? 'Назва завдання від руки' : 'Handwrite task title',
                value: task.title,
                onApply: value => handleFieldChange('title', value),
              })} aria-label={lang === 'uk' ? 'Написати назву Apple Pencil' : 'Write title with Apple Pencil'} title="Apple Pencil">
                <PenLine size={17} />
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label>{getTranslation(lang, 'description')}</label>
            <div className="handwriting-field-row handwriting-textarea-row">
              <textarea
                className="form-control"
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={task.description}
                onChange={e => handleFieldChange('description', e.target.value)}
              />
              <button type="button" className="handwriting-trigger" onClick={() => setHandwritingEditor({
                title: lang === 'uk' ? 'Опис завдання від руки' : 'Handwrite task description',
                value: task.description,
                multiline: true,
                onApply: value => handleFieldChange('description', value),
              })} aria-label={lang === 'uk' ? 'Написати опис Apple Pencil' : 'Write description with Apple Pencil'} title="Apple Pencil">
                <PenLine size={17} />
              </button>
            </div>
          </div>

          {/* Dates */}
          <div className="row-2">
            <div className="form-group">
              <label>{getTranslation(lang, 'startDate')}</label>
              <input
                type="date"
                className="form-control"
                value={task.startDate}
                disabled={task.subtasks && task.subtasks.length > 0}
                style={{ opacity: (task.subtasks && task.subtasks.length > 0) ? 0.6 : 1 }}
                onChange={e => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{getTranslation(lang, 'endDate')}</label>
              <input
                type="date"
                className="form-control"
                value={task.endDate}
                disabled={task.isMilestone || (task.subtasks && task.subtasks.length > 0)}
                style={{ opacity: (task.isMilestone || (task.subtasks && task.subtasks.length > 0)) ? 0.6 : 1 }}
                onChange={e => handleEndDateChange(e.target.value)}
              />
            </div>
          </div>
          
          {task.subtasks && task.subtasks.length > 0 && (
            <div style={{ fontSize: '0.72rem', color: '#b57a3d', marginTop: '-4px', marginBottom: '8px', fontWeight: 600 }}>
              * {lang === 'uk' ? 'Дати розраховуються автоматично на основі підзавдань.' : 'Dates are calculated automatically based on subtasks.'}
            </div>
          )}

          {/* Milestone & Color selection */}
          <div className="row-2">
            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="drawer-milestone"
                checked={task.isMilestone}
                onChange={e => handleMilestoneToggle(e.target.checked)}
              />
              <label htmlFor="drawer-milestone" style={{ textTransform: 'none', cursor: 'pointer' }}>
                {getTranslation(lang, 'isMilestone')}
              </label>
            </div>
            
            <div className="form-group">
              <label>Колір / Color</label>
              <select
                className="form-control"
                value={task.color || '#6366f1'}
                onChange={e => handleFieldChange('color', e.target.value)}
              >
                {colorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {lang === 'uk' ? opt.labelUa : opt.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee & Status */}
          <div className="row-2">
            <div className="form-group">
              <label>{getTranslation(lang, 'assignee')}</label>
              <select
                className="form-control"
                value={task.assignee}
                onChange={e => handleFieldChange('assignee', e.target.value)}
              >
                <option value="">{lang === 'uk' ? 'Без виконавця' : 'Unassigned'}</option>
                {teamMembers.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{getTranslation(lang, 'status')}</label>
              <select
                className="form-control"
                value={task.status}
                onChange={e => {
                  const newStatus = e.target.value as Task['status'];
                  const newProgress = newStatus === 'done' ? 100 : (task.progress === 100 ? 50 : task.progress);
                  onUpdate({
                    ...task,
                    status: newStatus,
                    progress: task.isMilestone ? 0 : newProgress
                  });
                }}
              >
                <option value="todo">{getTranslation(lang, 'todo')}</option>
                <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                <option value="done">{getTranslation(lang, 'done')}</option>
              </select>
            </div>
          </div>

          {/* Progress (Slider) */}
          {!task.isMilestone && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label>{getTranslation(lang, 'progress')}</label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{task.progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                style={{ accentColor: 'var(--primary)', height: '8px', cursor: 'pointer' }}
                value={task.progress}
                onChange={e => handleFieldChange('progress', parseInt(e.target.value))}
              />
            </div>
          )}

          {/* Dependencies */}
          <div className="form-group">
            <label>{getTranslation(lang, 'dependency')}</label>
            <select
              className="form-control"
              value={task.dependencyTaskId || ''}
              onChange={e => handleFieldChange('dependencyTaskId', e.target.value || undefined)}
            >
              <option value="">-- {lang === 'uk' ? 'Немає залежності' : 'No Dependency'} --</option>
              {eligiblePredecessors.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.startDate})
                </option>
              ))}
            </select>
          </div>

          <div className="task-reminder-card">
            <span className="task-reminder-icon"><Bell size={16} /></span>
            <span>
              <strong>{lang === 'uk' ? 'Нагадування про завдання' : 'Task reminders'}</strong>
              <small>
                {lang === 'uk'
                  ? `${reminders.filter(reminder => reminder.targetType === 'task' && reminder.taskId === task.id && !reminder.dismissedAt).length} заплановано`
                  : `${reminders.filter(reminder => reminder.targetType === 'task' && reminder.taskId === task.id && !reminder.dismissedAt).length} scheduled`}
              </small>
            </span>
            <button className="btn btn-secondary btn-compact" onClick={() => onAddReminder('task')}><Plus size={14} />{lang === 'uk' ? 'Додати' : 'Add'}</button>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Subtasks Section */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckSquare size={14} />
              {getTranslation(lang, 'subtasks')} ({task.subtasks?.filter(s => s.completed).length || 0}/{task.subtasks?.length || 0})
            </label>
            
            <form onSubmit={handleAddSubtask} className="input-with-btn" style={{ marginTop: '6px' }}>
              <input
                type="text"
                className="form-control"
                placeholder={getTranslation(lang, 'addSubtaskPlaceholder')}
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
              />
              <button type="button" className="handwriting-trigger" onClick={() => setHandwritingEditor({
                title: lang === 'uk' ? 'Нове підзавдання від руки' : 'Handwrite a new subtask',
                value: newSubtaskTitle,
                onApply: setNewSubtaskTitle,
              })} aria-label={lang === 'uk' ? 'Написати підзавдання Apple Pencil' : 'Write subtask with Apple Pencil'} title="Apple Pencil">
                <PenLine size={16} />
              </button>
              <button type="submit" className="btn btn-secondary" style={{ width: 'auto', padding: '0 12px' }}>
                <Plus size={16} />
              </button>
            </form>

            <div className="checklist-items" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {task.subtasks?.map(s => (
                <div key={s.id} className={`checklist-item ${s.completed ? 'completed' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(0,0,0,0.01)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={s.completed}
                      style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      onChange={() => handleToggleSubtask(s.id)}
                    />
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>{s.title}</span>
                    <button type="button" className="btn-icon subtask-handwriting-button" onClick={() => setHandwritingEditor({
                      title: lang === 'uk' ? 'Назва підзавдання від руки' : 'Handwrite subtask title',
                      value: s.title,
                      onApply: value => handleFieldChange('subtasks', task.subtasks.map(sub => sub.id === s.id ? { ...sub, title: value } : sub)),
                    })} aria-label={lang === 'uk' ? `Написати «${s.title}» Apple Pencil` : `Write “${s.title}” with Apple Pencil`} title="Apple Pencil">
                      <PenLine size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon subtask-reminder-button"
                      onClick={() => onAddReminder('subtask', s.id)}
                      title={lang === 'uk' ? 'Додати нагадування' : 'Add reminder'}
                      aria-label={`${lang === 'uk' ? 'Додати нагадування' : 'Add reminder'}: ${s.title}`}
                    >
                      <Bell size={12} />
                      {reminders.some(reminder => reminder.targetType === 'subtask' && reminder.subtaskId === s.id && !reminder.dismissedAt) && <i />}
                    </button>
                    <button 
                      type="button" 
                      className="btn-icon" 
                      style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent' }}
                      onClick={() => handleDeleteSubtask(s.id)}
                    >
                      <Trash2 size={12} color="var(--text-muted)" />
                    </button>
                  </div>
                  
                  {/* Scheduling Sub-row */}
                  <div style={{ display: 'flex', gap: '6px', paddingLeft: '22px', alignItems: 'center' }}>
                    <select
                      className="subtask-status-select"
                      value={s.status ?? (s.completed ? 'done' : 'todo')}
                      title={lang === 'uk' ? 'Статус підзавдання' : 'Subtask status'}
                      onChange={(event) => {
                        const status = event.target.value as NonNullable<SubTask['status']>;
                        const updated = task.subtasks.map(sub =>
                          sub.id === s.id ? { ...sub, status, completed: status === 'done' } : sub
                        );
                        handleFieldChange('subtasks', updated);
                      }}
                    >
                      <option value="todo">{getTranslation(lang, 'todo')}</option>
                      <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                      <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                      <option value="done">{getTranslation(lang, 'done')}</option>
                    </select>
                    <input 
                      type="date" 
                      style={{ padding: '2px 4px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                      value={s.startDate || ''}
                      placeholder="Start"
                      title={lang === 'uk' ? 'Дата початку підзавдання' : 'Subtask Start Date'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = task.subtasks.map(sub => 
                          sub.id === s.id ? { 
                            ...sub, 
                            startDate: val || undefined,
                            endDate: sub.endDate || val || undefined
                          } : sub
                        );
                        handleFieldChange('subtasks', updated);
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>→</span>
                    <input 
                      type="date" 
                      style={{ padding: '2px 4px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                      value={s.endDate || ''}
                      placeholder="End"
                      title={lang === 'uk' ? 'Дата завершення підзавдання' : 'Subtask End Date'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = task.subtasks.map(sub => 
                          sub.id === s.id ? { 
                            ...sub, 
                            endDate: val || undefined,
                            startDate: sub.startDate || val || undefined
                          } : sub
                        );
                        handleFieldChange('subtasks', updated);
                      }}
                    />
                    <select
                      style={{ padding: '2px 4px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', flex: 1 }}
                      value={s.assignee || ''}
                      title={lang === 'uk' ? 'Виконавець підзавдання' : 'Subtask Assignee'}
                      onChange={(e) => {
                        const updated = task.subtasks.map(sub => 
                          sub.id === s.id ? { ...sub, assignee: e.target.value || undefined } : sub
                        );
                        handleFieldChange('subtasks', updated);
                      }}
                    >
                      <option value="">👤 {lang === 'uk' ? 'Виконавець' : 'Assignee'}</option>
                      {teamMembers.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Comments Section */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} />
              {getTranslation(lang, 'comments')} ({task.comments?.length || 0})
            </label>

            {/* Post comment form */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {lang === 'uk' ? 'Коментар від' : 'Comment by'}: <strong>{currentUserEmail}</strong>
              </div>

              <div className="input-with-btn">
                <input
                  type="text"
                  className="form-control"
                  placeholder={getTranslation(lang, 'addCommentPlaceholder')}
                  value={newCommentContent}
                  onChange={e => setNewCommentContent(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 12px' }}>
                  <Send size={14} />
                </button>
              </div>
            </form>

            <div className="comments-list">
              {task.comments?.map(c => (
                <div key={c.id} className="comment-card">
                  <div 
                    className="comment-avatar" 
                    style={{ backgroundColor: c.avatarColor }}
                  >
                    {c.author.substring(0, 2)}
                  </div>
                  <div className="comment-body">
                    <div className="comment-meta">
                      <span className="comment-author">{c.author}</span>
                      <span className="comment-time">{c.timestamp}</span>
                    </div>
                    <p className="comment-text">{c.content}</p>
                  </div>
                </div>
              ))}
              {(!task.comments || task.comments.length === 0) && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  {getTranslation(lang, 'noComments')}
                </div>
              )}
            </div>
          </div>
        </div>

        {handwritingEditor && (
          <HandwritingInputDialog
            value={handwritingEditor.value}
            title={handwritingEditor.title}
            multiline={handwritingEditor.multiline}
            lang={lang}
            onApply={handwritingEditor.onApply}
            onClose={() => setHandwritingEditor(null)}
          />
        )}

        {/* Footer actions */}
        <div className="drawer-footer">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            {getTranslation(lang, 'close')}
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ width: 'auto', padding: '10px 16px' }} 
            onClick={() => onClone(task.id)}
            title={getTranslation(lang, 'cloneTaskTooltip')}
          >
            <Copy size={16} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '10px 16px' }}
            onClick={() => onArchive(task.id)}
            title={lang === 'uk' ? 'Архівувати завдання' : 'Archive task'}
            aria-label={lang === 'uk' ? 'Архівувати завдання' : 'Archive task'}
          >
            <Archive size={16} />
          </button>
          <button 
            className="btn btn-danger" 
            style={{ width: 'auto', padding: '10px 16px' }} 
            onClick={() => {
              if (confirm(lang === 'uk' ? 'Видалити це завдання?' : 'Delete this task?')) {
                onDelete(task.id);
              }
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
