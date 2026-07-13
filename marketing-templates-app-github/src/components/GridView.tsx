import type { Task, Language } from '../types';
import { TEAM_MEMBERS } from '../data/templatesData';
import { getTranslation } from '../utils/locales';
import { AlertTriangle, Plus, Trash2, Eye, Copy } from 'lucide-react';

interface GridViewProps {
  tasks: Task[];
  updateTask: (task: Task) => void;
  addTask: () => void;
  cloneTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  lang: Language;
}

// Timezone-safe local date utilities
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

const getDaysBetween = (d1: Date, d2: Date): number => {
  const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export default function GridView({
  tasks,
  updateTask,
  addTask,
  cloneTask,
  deleteTask,
  setSelectedTaskId,
  lang
}: GridViewProps) {

  // Update date fields and keep scheduling logical
  const handleStartDateChange = (task: Task, newStartStr: string) => {
    if (!newStartStr) return;
    const oldStart = parseLocalDate(task.startDate);
    const oldEnd = parseLocalDate(task.endDate);
    const duration = getDaysBetween(oldStart, oldEnd);
    
    const newStart = parseLocalDate(newStartStr);
    const newEnd = addDays(newStart, duration);

    updateTask({
      ...task,
      startDate: newStartStr,
      endDate: formatLocalDate(newEnd)
    });
  };

  const handleEndDateChange = (task: Task, newEndStr: string) => {
    if (!newEndStr) return;
    const start = parseLocalDate(task.startDate);
    const newEnd = parseLocalDate(newEndStr);

    if (newEnd.getTime() >= start.getTime()) {
      updateTask({
        ...task,
        endDate: newEndStr
      });
    }
  };

  const handleDurationChange = (task: Task, newDurationDays: number) => {
    if (isNaN(newDurationDays) || newDurationDays < 1) return;
    const start = parseLocalDate(task.startDate);
    // duration of 5 days means: starts on July 15, ends on July 19 (duration = getDaysBetween + 1)
    const newEnd = addDays(start, newDurationDays - 1);
    
    updateTask({
      ...task,
      endDate: formatLocalDate(newEnd)
    });
  };

  return (
    <div className="grid-container">
      <div className="table-wrapper">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Plus size={22} /></div>
            <h3>{lang === 'uk' ? 'Немає завдань для показу' : 'No tasks to show'}</h3>
            <p>{lang === 'uk' ? 'Додайте перше завдання або очистіть фільтри.' : 'Add the first task or clear the filters.'}</p>
            <button className="btn btn-primary btn-auto" onClick={addTask}>
              <Plus size={16} />
              {getTranslation(lang, 'addTask')}
            </button>
          </div>
        ) : (
          <table className="editable-table">
            <thead>
              <tr>
                <th className="col-indicator" />
                <th>{getTranslation(lang, 'taskTitle')}</th>
                <th className="col-assignee">{getTranslation(lang, 'assignee')}</th>
                <th className="col-date">{getTranslation(lang, 'startDate')}</th>
                <th className="col-date">{getTranslation(lang, 'endDate')}</th>
                <th className="col-duration">{getTranslation(lang, 'duration')}</th>
                <th className="col-progress">{getTranslation(lang, 'progress')}</th>
                <th className="col-status">{getTranslation(lang, 'status')}</th>
                <th className="col-milestone">{getTranslation(lang, 'isMilestone')}</th>
                <th className="col-actions">{lang === 'uk' ? 'Дії' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
              const start = parseLocalDate(t.startDate);
              const end = parseLocalDate(t.endDate);
              const duration = getDaysBetween(start, end) + 1;

              // Check for dependency warnings
              let hasWarning = false;
              if (t.dependencyTaskId) {
                const pred = tasks.find(p => p.id === t.dependencyTaskId);
                if (pred && parseLocalDate(pred.endDate) > start) {
                  hasWarning = true;
                }
              }

              return (
                <tr key={t.id}>
                  {/* Warning Dot Indicator */}
                  <td className="cell-center">
                    {hasWarning && (
                      <span title={getTranslation(lang, 'warningDependency')}>
                        <AlertTriangle 
                          size={16} 
                          color="var(--danger)" 
                        />
                      </span>
                    )}
                  </td>
                  
                  {/* Task Title */}
                  <td>
                    <input
                      type="text"
                      className="table-input"
                      data-strong={t.isMilestone ? 'true' : 'false'}
                      value={t.title}
                      onChange={e => updateTask({ ...t, title: e.target.value })}
                    />
                  </td>

                  {/* Assignee */}
                  <td>
                    <select
                      className="table-select"
                      value={t.assignee}
                      onChange={e => updateTask({ ...t, assignee: e.target.value })}
                    >
                      {TEAM_MEMBERS.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({lang === 'uk' ? m.roleUa : m.roleEn})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Start Date */}
                  <td>
                    <input
                      type="date"
                      className="table-input"
                      value={t.startDate}
                      disabled={t.subtasks && t.subtasks.length > 0}
                      onChange={e => handleStartDateChange(t, e.target.value)}
                    />
                  </td>

                  {/* End Date */}
                  <td>
                    <input
                      type="date"
                      className="table-input"
                      value={t.endDate}
                      disabled={t.isMilestone || (t.subtasks && t.subtasks.length > 0)}
                      onChange={e => handleEndDateChange(t, e.target.value)}
                    />
                  </td>

                  {/* Duration */}
                  <td>
                    <input
                      type="number"
                      className="table-input"
                      value={t.isMilestone ? 0 : duration}
                      disabled={t.isMilestone || (t.subtasks && t.subtasks.length > 0)}
                      min="1"
                      onChange={e => handleDurationChange(t, parseInt(e.target.value))}
                    />
                  </td>

                  {/* Progress */}
                  <td>
                    <div className="progress-input-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        className="progress-range"
                        value={t.progress}
                        disabled={t.isMilestone}
                        onChange={e => updateTask({ ...t, progress: parseInt(e.target.value) })}
                      />
                      <span className="progress-number">{t.isMilestone ? '-' : `${t.progress}%`}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <select
                      className="table-select"
                      value={t.status}
                      onChange={e => {
                        const newStatus = e.target.value as Task['status'];
                        // Sync progress automatically for done status
                        const newProgress = newStatus === 'done' ? 100 : (t.progress === 100 ? 50 : t.progress);
                        updateTask({ 
                          ...t, 
                          status: newStatus,
                          progress: t.isMilestone ? 0 : newProgress
                        });
                      }}
                    >
                      <option value="todo">{getTranslation(lang, 'todo')}</option>
                      <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                      <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                      <option value="done">{getTranslation(lang, 'done')}</option>
                    </select>
                  </td>

                  {/* Milestone */}
                  <td className="cell-center">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={t.isMilestone}
                      onChange={e => {
                        const isMilestone = e.target.checked;
                        updateTask({
                          ...t,
                          isMilestone,
                          // Milestones end on their start date and have 0 progress
                          endDate: isMilestone ? t.startDate : t.endDate,
                          progress: isMilestone ? 0 : t.progress
                        });
                      }}
                    />
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-icon-sm" 
                        onClick={() => setSelectedTaskId(t.id)}
                        title={getTranslation(lang, 'taskDetails')}
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        className="btn-icon btn-icon-sm" 
                        onClick={() => cloneTask(t.id)}
                        title={getTranslation(lang, 'cloneTaskTooltip')}
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="btn-icon btn-icon-sm danger-icon" 
                        onClick={() => deleteTask(t.id)}
                        title={getTranslation(lang, 'delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        )}
      </div>

      <button 
        className="btn btn-primary btn-auto grid-add-btn" 
        onClick={addTask}
      >
        <Plus size={16} />
        {getTranslation(lang, 'addTask')}
      </button>
    </div>
  );
}
