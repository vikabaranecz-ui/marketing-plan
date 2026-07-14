import { useState } from 'react';
import type { Task, SubTask, Language, TeamMember } from '../types';
import { getTranslation } from '../utils/locales';
import { Calendar, CheckSquare, Eye, ListChecks, Plus, Rows3, X } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  updateTask: (task: Task) => void;
  setSelectedTaskId: (id: string | null) => void;
  lang: Language;
  addTask: (status: Task['status']) => void;
  teamMembers: TeamMember[];
}

type BoardMode = 'tasks' | 'subtasks';
type DragPayload =
  | { kind: 'task'; taskId: string }
  | { kind: 'subtask'; taskId: string; subtaskId: string };

const columns: { id: Task['status']; titleKey: 'todo' | 'in_progress' | 'in_review' | 'done'; color: string }[] = [
  { id: 'todo', titleKey: 'todo', color: '#6b7280' },
  { id: 'in_progress', titleKey: 'in_progress', color: 'var(--primary)' },
  { id: 'in_review', titleKey: 'in_review', color: 'var(--warning)' },
  { id: 'done', titleKey: 'done', color: 'var(--success)' },
];

const getSubtaskStatus = (subtask: SubTask): Task['status'] =>
  subtask.status ?? (subtask.completed ? 'done' : 'todo');

export default function KanbanBoard({
  tasks,
  updateTask,
  setSelectedTaskId,
  lang,
  addTask,
  teamMembers,
}: KanbanBoardProps) {
  const [boardMode, setBoardMode] = useState<BoardMode>('tasks');
  const [newSubtaskParentId, setNewSubtaskParentId] = useState(tasks[0]?.id ?? '');
  const [composerStatus, setComposerStatus] = useState<Task['status'] | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const selectedParentId = tasks.some(task => task.id === newSubtaskParentId)
    ? newSubtaskParentId
    : tasks[0]?.id ?? '';
  const subtaskCount = tasks.reduce((sum, task) => sum + task.subtasks.length, 0);

  const getAssigneeColor = (name: string): string =>
    teamMembers.find(member => member.name === name)?.avatarColor ?? '#6b7280';

  const startDrag = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  };

  const updateTaskStatus = (task: Task, status: Task['status']) => {
    if (task.status === status) return;
    updateTask({
      ...task,
      status,
      progress: status === 'done' ? 100 : (task.progress === 100 ? 50 : task.progress),
    });
  };

  const updateSubtaskStatus = (taskId: string, subtaskId: string, status: Task['status']) => {
    const parent = tasks.find(task => task.id === taskId);
    if (!parent) return;
    updateTask({
      ...parent,
      subtasks: parent.subtasks.map(subtask =>
        subtask.id === subtaskId
          ? { ...subtask, status, completed: status === 'done' }
          : subtask
      ),
    });
  };

  const handleDrop = (event: React.DragEvent, targetStatus: Task['status']) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload;
      if (payload.kind === 'task') {
        const task = tasks.find(item => item.id === payload.taskId);
        if (task) updateTaskStatus(task, targetStatus);
      } else {
        updateSubtaskStatus(payload.taskId, payload.subtaskId, targetStatus);
      }
    } catch {
      // Ignore drops that do not originate from this board.
    }
  };

  const handleAddSubtask = (event: React.FormEvent, status: Task['status']) => {
    event.preventDefault();
    const parent = tasks.find(task => task.id === selectedParentId);
    const title = newSubtaskTitle.trim();
    if (!parent || !title) return;

    const newSubtask: SubTask = {
      id: `sub_${Date.now()}`,
      title,
      completed: status === 'done',
      status,
      startDate: parent.startDate,
      endDate: parent.endDate,
      assignee: parent.assignee || undefined,
    };
    updateTask({ ...parent, subtasks: [...parent.subtasks, newSubtask] });
    setNewSubtaskTitle('');
    setComposerStatus(null);
  };

  return (
    <div className="kanban-workspace">
      <div className="kanban-toolbar">
        <div className="kanban-mode-switch" role="group" aria-label={lang === 'uk' ? 'Тип дошки' : 'Board type'}>
          <button
            className={boardMode === 'tasks' ? 'active' : ''}
            onClick={() => setBoardMode('tasks')}
          >
            <Rows3 size={15} />
            {lang === 'uk' ? 'Завдання' : 'Tasks'}
            <span>{tasks.length}</span>
          </button>
          <button
            className={boardMode === 'subtasks' ? 'active' : ''}
            onClick={() => setBoardMode('subtasks')}
          >
            <ListChecks size={15} />
            {lang === 'uk' ? 'Підзавдання' : 'Subtasks'}
            <span>{subtaskCount}</span>
          </button>
        </div>

        {boardMode === 'subtasks' && tasks.length > 0 && (
          <label className="kanban-parent-picker">
            <span>{lang === 'uk' ? 'Батьківське завдання для нових:' : 'Parent task for new items:'}</span>
            <select value={selectedParentId} onChange={event => setNewSubtaskParentId(event.target.value)}>
              {tasks.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="kanban-container kanban-container-expanded">
        {columns.map(column => {
          const columnTasks = tasks.filter(task => task.status === column.id);
          const columnSubtasks = tasks.flatMap(parent =>
            parent.subtasks
              .filter(subtask => getSubtaskStatus(subtask) === column.id)
              .map(subtask => ({ parent, subtask }))
          );
          const itemCount = boardMode === 'tasks' ? columnTasks.length : columnSubtasks.length;

          return (
            <section
              key={column.id}
              className="kanban-column"
              onDragOver={event => event.preventDefault()}
              onDrop={event => handleDrop(event, column.id)}
            >
              <div className="kanban-header">
                <span className="kanban-title">
                  <span className="status-dot" style={{ backgroundColor: column.color }} />
                  {getTranslation(lang, column.titleKey)}
                </span>
                <span className="kanban-count">{itemCount}</span>
              </div>

              <div className="kanban-cards">
                {boardMode === 'tasks' && columnTasks.map(task => (
                  <article
                    key={task.id}
                    className="kanban-card kanban-task-card"
                    draggable
                    onDragStart={event => startDrag(event, { kind: 'task', taskId: task.id })}
                    style={{ '--card-accent': task.color ?? '#6366f1' } as React.CSSProperties}
                  >
                    <div className="card-top">
                      <span className={`card-title ${task.status === 'done' ? 'completed' : ''}`}>
                        {task.isMilestone && <span className="milestone-symbol">◆</span>}
                        {task.title}
                      </span>
                      <button
                        className="btn-icon btn-icon-sm"
                        onClick={() => setSelectedTaskId(task.id)}
                        title={getTranslation(lang, 'taskDetails')}
                        aria-label={`${getTranslation(lang, 'taskDetails')}: ${task.title}`}
                      >
                        <Eye size={12} />
                      </button>
                    </div>

                    <div className="card-date">
                      <Calendar size={12} />
                      <span>{task.startDate} {task.isMilestone ? '' : `→ ${task.endDate}`}</span>
                    </div>

                    {task.subtasks.length > 0 && (
                      <div className="kanban-subtask-summary">
                        <CheckSquare size={12} />
                        <span>{task.subtasks.filter(item => item.completed).length}/{task.subtasks.length} {lang === 'uk' ? 'підзавдань' : 'subtasks'}</span>
                      </div>
                    )}

                    {!task.isMilestone && (
                      <div className="progress-bar-bg" style={{ height: '4px' }}>
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${task.progress}%`, backgroundColor: task.status === 'done' ? 'var(--success)' : (task.color || 'var(--primary)') }}
                        />
                      </div>
                    )}

                    <div className="card-footer kanban-card-footer-expanded">
                      <div className="assignee-badge">
                        <span className="assignee-dot" style={{ backgroundColor: getAssigneeColor(task.assignee) }} />
                        <span>{task.assignee || (lang === 'uk' ? 'Без виконавця' : 'Unassigned')}</span>
                      </div>
                      <select
                        className="kanban-status-select"
                        value={task.status}
                        onChange={event => updateTaskStatus(task, event.target.value as Task['status'])}
                        aria-label={lang === 'uk' ? 'Змінити статус завдання' : 'Change task status'}
                      >
                        {columns.map(option => (
                          <option value={option.id} key={option.id}>{getTranslation(lang, option.titleKey)}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}

                {boardMode === 'subtasks' && columnSubtasks.map(({ parent, subtask }) => (
                  <article
                    key={`${parent.id}-${subtask.id}`}
                    className="kanban-card kanban-subtask-card"
                    draggable
                    onDragStart={event => startDrag(event, { kind: 'subtask', taskId: parent.id, subtaskId: subtask.id })}
                    style={{ '--card-accent': parent.color ?? '#6366f1' } as React.CSSProperties}
                  >
                    <div className="kanban-parent-label" title={parent.title}>
                      <span style={{ background: parent.color ?? '#6366f1' }} />
                      {parent.title}
                    </div>
                    <div className="card-top">
                      <span className={`card-title ${getSubtaskStatus(subtask) === 'done' ? 'completed' : ''}`}>{subtask.title}</span>
                      <button
                        className="btn-icon btn-icon-sm"
                        onClick={() => setSelectedTaskId(parent.id)}
                        title={lang === 'uk' ? 'Відкрити батьківське завдання' : 'Open parent task'}
                        aria-label={`${lang === 'uk' ? 'Відкрити батьківське завдання' : 'Open parent task'}: ${parent.title}`}
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                    <div className="card-date">
                      <Calendar size={12} />
                      <span>{subtask.startDate || parent.startDate} → {subtask.endDate || parent.endDate}</span>
                    </div>
                    <div className="card-footer kanban-card-footer-expanded">
                      <div className="assignee-badge">
                        <span className="assignee-dot" style={{ backgroundColor: getAssigneeColor(subtask.assignee ?? parent.assignee) }} />
                        <span>{subtask.assignee || parent.assignee || (lang === 'uk' ? 'Без виконавця' : 'Unassigned')}</span>
                      </div>
                      <select
                        className="kanban-status-select"
                        value={getSubtaskStatus(subtask)}
                        onChange={event => updateSubtaskStatus(parent.id, subtask.id, event.target.value as Task['status'])}
                        aria-label={lang === 'uk' ? 'Змінити статус підзавдання' : 'Change subtask status'}
                      >
                        {columns.map(option => (
                          <option value={option.id} key={option.id}>{getTranslation(lang, option.titleKey)}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}

                {itemCount === 0 && (
                  <div className="kanban-empty">{lang === 'uk' ? 'Перетягніть картку сюди' : 'Drop cards here'}</div>
                )}
              </div>

              <div className="kanban-footer">
                {boardMode === 'tasks' ? (
                  <button className="btn btn-secondary btn-compact" onClick={() => addTask(column.id)}>
                    <Plus size={14} />
                    {getTranslation(lang, 'addTask')}
                  </button>
                ) : composerStatus === column.id ? (
                  <form className="kanban-inline-composer" onSubmit={event => handleAddSubtask(event, column.id)}>
                    <input
                      autoFocus
                      value={newSubtaskTitle}
                      onChange={event => setNewSubtaskTitle(event.target.value)}
                      placeholder={getTranslation(lang, 'addSubtaskPlaceholder')}
                    />
                    <button
                      type="submit"
                      className="btn-icon btn-icon-sm"
                      disabled={!newSubtaskTitle.trim()}
                      aria-label={lang === 'uk' ? 'Додати підзавдання' : 'Add subtask'}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-sm"
                      onClick={() => { setComposerStatus(null); setNewSubtaskTitle(''); }}
                      aria-label={lang === 'uk' ? 'Скасувати додавання' : 'Cancel adding'}
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <button
                    className="btn btn-secondary btn-compact"
                    disabled={!selectedParentId}
                    onClick={() => setComposerStatus(column.id)}
                  >
                    <Plus size={14} />
                    {lang === 'uk' ? 'Додати підзавдання' : 'Add subtask'}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
