import React from 'react';
import type { Task, Language, TeamMember } from '../types';
import { getTranslation } from '../utils/locales';
import { Calendar, Eye, Plus } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  updateTask: (task: Task) => void;
  setSelectedTaskId: (id: string | null) => void;
  lang: Language;
  addTask: (status: Task['status']) => void;
  teamMembers: TeamMember[];
}

export default function KanbanBoard({
  tasks,
  updateTask,
  setSelectedTaskId,
  lang,
  addTask,
  teamMembers,
}: KanbanBoardProps) {

  const columns: { id: Task['status']; titleKey: 'todo' | 'in_progress' | 'in_review' | 'done'; color: string }[] = [
    { id: 'todo', titleKey: 'todo', color: '#6b7280' },
    { id: 'in_progress', titleKey: 'in_progress', color: 'var(--primary)' },
    { id: 'in_review', titleKey: 'in_review', color: 'var(--warning)' },
    { id: 'done', titleKey: 'done', color: 'var(--success)' }
  ];

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      updateTask({
        ...task,
        status: targetStatus,
        progress: targetStatus === 'done' ? 100 : (task.progress === 100 ? 50 : task.progress)
      });
    }
  };

  const getAssigneeColor = (name: string): string => {
    const member = teamMembers.find(m => m.name === name);
    return member ? member.avatarColor : '#6b7280';
  };

  return (
    <div className="kanban-container">
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        
        return (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="kanban-header">
              <span className="kanban-title">
                <span 
                  className="status-dot" 
                  style={{ backgroundColor: col.color }} 
                />
                {getTranslation(lang, col.titleKey)}
              </span>
              <span className="kanban-count">{colTasks.length}</span>
            </div>

            {/* Cards wrapper */}
            <div className="kanban-cards">
              {colTasks.map(t => (
                <div
                  key={t.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                >
                  <div className="card-top">
                    <span 
                      className="card-title"
                      style={{ 
                        textDecoration: t.status === 'done' ? 'line-through' : 'none',
                        color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)'
                      }}
                    >
                      {t.isMilestone && <span style={{ color: 'var(--danger)', marginRight: '4px' }}>◆</span>}
                      {t.title}
                    </span>
                    <button
                      className="btn-icon btn-icon-sm"
                      onClick={() => setSelectedTaskId(t.id)}
                      title={getTranslation(lang, 'taskDetails')}
                    >
                      <Eye size={12} />
                    </button>
                  </div>

                  {/* Dates */}
                  <div className="card-date">
                    <Calendar size={12} />
                    <span>
                      {t.startDate} {t.isMilestone ? '' : `→ ${t.endDate}`}
                    </span>
                  </div>

                  {/* Progress bar (except for milestones) */}
                  {!t.isMilestone && (
                    <div className="progress-bar-bg" style={{ height: '4px' }}>
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${t.progress}%`,
                          backgroundColor: t.status === 'done' ? 'var(--success)' : (t.color || 'var(--primary)')
                        }} 
                      />
                    </div>
                  )}

                  {/* Card Footer info */}
                  <div className="card-footer">
                    <div className="assignee-badge">
                      <span 
                        className="assignee-dot" 
                        style={{ backgroundColor: getAssigneeColor(t.assignee) }} 
                      />
                      <span>{t.assignee}</span>
                    </div>

                    {!t.isMilestone && (
                      <span className="card-progress-label">
                        {t.progress}%
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {colTasks.length === 0 && (
                <div className="kanban-empty">
                  {lang === 'uk' ? 'Перетягніть картку сюди' : 'Drop cards here'}
                </div>
              )}
            </div>

            {/* Column Footer with add button */}
            <div className="kanban-footer">
              <button 
                className="btn btn-secondary btn-compact" 
                onClick={() => addTask(col.id)}
              >
                <Plus size={14} />
                {getTranslation(lang, 'addTask')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
