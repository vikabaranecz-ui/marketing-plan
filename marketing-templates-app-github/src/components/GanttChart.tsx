import React, { useRef, useState, useEffect } from 'react';
import type { Task, ZoomLevel, Language } from '../types';
import { getTranslation } from '../utils/locales';
import { Plus } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  updateTask: (task: Task) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  zoomLevel: ZoomLevel;
  lang: Language;
  addTask: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  showSidebar?: boolean;
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

const getMonthName = (monthIndex: number, lang: Language): string => {
  const monthsUa = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Груд'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return lang === 'uk' ? monthsUa[monthIndex] : monthsEn[monthIndex];
};

const getDayOfWeekLetter = (date: Date, lang: Language): string => {
  const lettersUa = ['Н', 'П', 'В', 'С', 'Ч', 'П', 'С']; // 0 = Sunday (Неділя), 1 = Monday (Понеділок)...
  const lettersEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return lang === 'uk' ? lettersUa[date.getDay()] : lettersEn[date.getDay()];
};

const formatDisplayDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};

interface RowItem {
  id: string; // t.id or `${t.id}__sub__${sub.id}`
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: Task['status'];
  isMilestone: boolean;
  color?: string;
  isSubtask: boolean;
  isGroup: boolean;
  parentId?: string;
  subtaskId?: string;
  assignee?: string;
}

export default function GanttChart({
  tasks,
  updateTask,
  selectedTaskId,
  setSelectedTaskId,
  zoomLevel,
  lang,
  addTask,
  onDragStart,
  onDragEnd,
  showSidebar = true
}: GanttChartProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Drag states
  const [dragState, setDragState] = useState<{
    taskId: string;
    subtaskId?: string;
    action: 'drag' | 'resize' | 'resize-left';
    initialMouseX: number;
    initialStartDate: Date;
    initialEndDate: Date;
  } | null>(null);

  // Dependency drawing connection state
  const [connectState, setConnectState] = useState<{
    fromTaskId: string;
    fromX: number;
    fromY: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // Collapsed tasks set tracking
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

  const toggleTaskCollapse = (taskId: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Flatten tasks to include parent tasks and their subtasks as separate rows, respecting collapse state
  const rowItems = React.useMemo(() => {
    const list: RowItem[] = [];

    tasks.forEach(t => {
      const isGroup = t.subtasks && t.subtasks.length > 0;
      list.push({
        id: t.id,
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        progress: t.progress,
        status: t.status,
        isMilestone: t.isMilestone,
        color: t.color,
        isSubtask: false,
        isGroup: isGroup,
        assignee: t.assignee
      });

      if (isGroup && !collapsedTasks.has(t.id)) {
        t.subtasks.forEach(sub => {
          list.push({
            id: `${t.id}__sub__${sub.id}`,
            title: sub.title,
            startDate: sub.startDate || t.startDate,
            endDate: sub.endDate || t.endDate,
            progress: sub.completed ? 100 : 0,
            status: sub.completed ? 'done' : t.status,
            isMilestone: false,
            isGroup: false,
            isSubtask: true,
            parentId: t.id,
            subtaskId: sub.id,
            color: t.color,
            assignee: sub.assignee || t.assignee
          });
        });
      }
    });

    return list;
  }, [tasks, collapsedTasks]);

  // 1. Calculate Timeline Range boundaries
  const getTimelineBounds = () => {
    if (rowItems.length === 0) {
      const today = new Date();
      return {
        start: addDays(today, -5),
        end: addDays(today, 25)
      };
    }

    const startDates = rowItems.map(r => parseLocalDate(r.startDate).getTime());
    const endDates = rowItems.map(r => parseLocalDate(r.endDate).getTime());
    
    const minTime = Math.min(...startDates);
    const maxTime = Math.max(...endDates);

    // Add buffers for elegant aesthetics
    return {
      start: addDays(new Date(minTime), -7),
      end: addDays(new Date(maxTime), 14)
    };
  };

  const { start: timelineStart, end: timelineEnd } = getTimelineBounds();
  const totalDays = getDaysBetween(timelineStart, timelineEnd) + 1;

  // 2. Set grid cell configurations based on Zoom Level
  let pixelsPerDay = 45;
  let cellWidth = 45; // default for 'days'
  
  if (zoomLevel === 'weeks') {
    pixelsPerDay = 15; // 105px per 7-day week cell
    cellWidth = 105;
  } else if (zoomLevel === 'months') {
    pixelsPerDay = 4; // ~120px per 30-day month cell
    cellWidth = 120;
  }

  // Sync scroll between sidebar and canvas row bodies
  const sidebarRowsRef = useRef<HTMLDivElement>(null);
  const handleCanvasScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (sidebarRowsRef.current) {
      sidebarRowsRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Automatically scroll list and canvas to the bottom when a new row is added
  const prevRowCount = useRef(rowItems.length);
  useEffect(() => {
    if (rowItems.length > prevRowCount.current) {
      setTimeout(() => {
        if (sidebarRowsRef.current) {
          sidebarRowsRef.current.scrollTop = sidebarRowsRef.current.scrollHeight;
        }
        if (canvasRef.current) {
          canvasRef.current.scrollTop = canvasRef.current.scrollHeight;
        }
      }, 60);
    }
    prevRowCount.current = rowItems.length;
  }, [rowItems.length]);

  // 3. Render Header Columns cells
  const renderHeaderCells = () => {
    const cells: React.ReactNode[] = [];
    
    if (zoomLevel === 'days') {
      for (let i = 0; i < totalDays; i++) {
        const currentDate = addDays(timelineStart, i);
        const dayNum = currentDate.getDate();
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const dayOfWeekLetter = getDayOfWeekLetter(currentDate, lang);
        
        cells.push(
          <div 
            key={`h-day-${i}`} 
            className={`timeline-header-cell day-zoom-cell ${isWeekend ? 'weekend' : ''}`}
            style={{ 
              width: `${cellWidth}px`
            }}
          >
            <span className="top-lbl" style={{ color: isWeekend ? '#0066cc' : 'var(--text-secondary)', fontWeight: 'bold' }}>
              {dayNum}
            </span>
            <span className="bottom-lbl" style={{ color: isWeekend ? '#0066cc' : 'var(--text-primary)', fontWeight: 600 }}>
              {dayOfWeekLetter}
            </span>
          </div>
        );
      }
    } else if (zoomLevel === 'weeks') {
      const weeksCount = Math.ceil(totalDays / 7);
      for (let i = 0; i < weeksCount; i++) {
        const weekStartDate = addDays(timelineStart, i * 7);
        const monthIndex = weekStartDate.getMonth();
        const dayNum = weekStartDate.getDate();
        
        cells.push(
          <div 
            key={`h-week-${i}`} 
            className="timeline-header-cell"
            style={{ width: `${cellWidth}px` }}
          >
            <span className="top-lbl">{getMonthName(monthIndex, lang)}</span>
            <span className="bottom-lbl">
              {lang === 'uk' ? 'Тиж.' : 'W'}{i + 1} ({dayNum})
            </span>
          </div>
        );
      }
    } else if (zoomLevel === 'months') {
      const monthsCount = Math.ceil(totalDays / 30);
      for (let i = 0; i < monthsCount; i++) {
        const monthStartDate = addDays(timelineStart, i * 30);
        const monthIndex = monthStartDate.getMonth();
        const year = monthStartDate.getFullYear();
        
        cells.push(
          <div 
            key={`h-month-${i}`} 
            className="timeline-header-cell"
            style={{ width: `${cellWidth}px` }}
          >
            <span className="top-lbl">{year}</span>
            <span className="bottom-lbl">{getMonthName(monthIndex, lang)}</span>
          </div>
        );
      }
    }
    
    return cells;
  };

  // 4. Drag & Resize mouse event handlers
  const handleBarMouseDown = (
    e: React.MouseEvent,
    row: RowItem,
    action: 'drag' | 'resize' | 'resize-left'
  ) => {
    e.stopPropagation();
    onDragStart?.();

    let taskId = row.id;
    let subtaskId: string | undefined = undefined;
    if (row.isSubtask) {
      taskId = row.parentId!;
      subtaskId = row.subtaskId!;
    }

    setDragState({
      taskId,
      subtaskId,
      action,
      initialMouseX: e.clientX,
      initialStartDate: parseLocalDate(row.startDate),
      initialEndDate: parseLocalDate(row.endDate)
    });
    
    document.body.style.cursor = action === 'drag' ? 'grabbing' : 'col-resize';
  };

  // Handle click down on connector dot
  const handleConnectorMouseDown = (
    e: React.MouseEvent,
    row: RowItem,
    direction: 'left' | 'right',
    startOffset: number,
    width: number,
    rowIndex: number
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const fromTaskId = row.isSubtask ? row.parentId! : row.id;
    const initialX = startOffset + (direction === 'right' ? width : 0);
    const initialY = rowIndex * 48 + 24;

    setConnectState({
      fromTaskId,
      fromX: initialX,
      fromY: initialY,
      mouseX: initialX,
      mouseY: initialY
    });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.initialMouseX;
      const deltaDays = Math.round(deltaX / pixelsPerDay);
      
      const parentTask = tasks.find(t => t.id === dragState.taskId);
      if (!parentTask) return;

      if (dragState.subtaskId) {
        // Dragging/resizing a subtask
        const sub = parentTask.subtasks.find(s => s.id === dragState.subtaskId);
        if (!sub) return;

        if (dragState.action === 'drag') {
          const newStart = addDays(dragState.initialStartDate, deltaDays);
          const newEnd = addDays(dragState.initialEndDate, deltaDays);
          const updatedSubtasks = parentTask.subtasks.map(s => 
            s.id === dragState.subtaskId ? {
              ...s,
              startDate: formatLocalDate(newStart),
              endDate: formatLocalDate(newEnd)
            } : s
          );
          updateTask({
            ...parentTask,
            subtasks: updatedSubtasks
          });
        } else if (dragState.action === 'resize-left') {
          const newStart = addDays(dragState.initialStartDate, deltaDays);
          const endD = parseLocalDate(sub.endDate || parentTask.endDate);
          if (newStart.getTime() <= endD.getTime()) {
            const updatedSubtasks = parentTask.subtasks.map(s => 
              s.id === dragState.subtaskId ? {
                ...s,
                startDate: formatLocalDate(newStart)
              } : s
            );
            updateTask({
              ...parentTask,
              subtasks: updatedSubtasks
            });
          }
        } else if (dragState.action === 'resize') {
          const newEnd = addDays(dragState.initialEndDate, deltaDays);
          const startD = parseLocalDate(sub.startDate || parentTask.startDate);
          if (newEnd.getTime() >= startD.getTime()) {
            const updatedSubtasks = parentTask.subtasks.map(s => 
              s.id === dragState.subtaskId ? {
                ...s,
                endDate: formatLocalDate(newEnd)
              } : s
            );
            updateTask({
              ...parentTask,
              subtasks: updatedSubtasks
            });
          }
        }
      } else {
        // Dragging/resizing a parent task
        if (dragState.action === 'drag') {
          const newStart = addDays(dragState.initialStartDate, deltaDays);
          const newEnd = addDays(dragState.initialEndDate, deltaDays);

          // Shift all subtasks by deltaDays as well!
          const updatedSubtasks = parentTask.subtasks.map(s => {
            if (s.startDate && s.endDate) {
              const subS = parseLocalDate(s.startDate);
              const subE = parseLocalDate(s.endDate);
              return {
                ...s,
                startDate: formatLocalDate(addDays(subS, deltaDays)),
                endDate: formatLocalDate(addDays(subE, deltaDays))
              };
            }
            return s;
          });

          updateTask({
            ...parentTask,
            startDate: formatLocalDate(newStart),
            endDate: formatLocalDate(newEnd),
            subtasks: updatedSubtasks
          });
        } else if (dragState.action === 'resize-left') {
          const newStart = addDays(dragState.initialStartDate, deltaDays);
          const endD = parseLocalDate(parentTask.endDate);
          if (newStart.getTime() <= endD.getTime()) {
            // Adjust the first subtask start date to match parent resizing
            const subtasksWithDates = parentTask.subtasks.filter(s => s.startDate && s.endDate);
            if (subtasksWithDates.length > 0) {
              const startTimes = subtasksWithDates.map(s => parseLocalDate(s.startDate!).getTime());
              const minTime = Math.min(...startTimes);
              const firstSubIndex = parentTask.subtasks.findIndex(s => s.startDate && parseLocalDate(s.startDate).getTime() === minTime);
              
              if (firstSubIndex !== -1) {
                const updatedSubtasks = [...parentTask.subtasks];
                updatedSubtasks[firstSubIndex] = {
                  ...updatedSubtasks[firstSubIndex],
                  startDate: formatLocalDate(newStart)
                };
                updateTask({
                  ...parentTask,
                  startDate: formatLocalDate(newStart),
                  subtasks: updatedSubtasks
                });
                return;
              }
            }

            updateTask({
              ...parentTask,
              startDate: formatLocalDate(newStart)
            });
          }
        } else if (dragState.action === 'resize') {
          const newEnd = addDays(dragState.initialEndDate, deltaDays);
          const startD = parseLocalDate(parentTask.startDate);
          if (newEnd.getTime() >= startD.getTime()) {
            // Resize the last ending subtask to match parent resizing
            const subtasksWithDates = parentTask.subtasks.filter(s => s.startDate && s.endDate);
            if (subtasksWithDates.length > 0) {
              const endTimes = subtasksWithDates.map(s => parseLocalDate(s.endDate!).getTime());
              const maxTime = Math.max(...endTimes);
              const lastSubIndex = parentTask.subtasks.findIndex(s => s.endDate && parseLocalDate(s.endDate).getTime() === maxTime);
              
              if (lastSubIndex !== -1) {
                const updatedSubtasks = [...parentTask.subtasks];
                updatedSubtasks[lastSubIndex] = {
                  ...updatedSubtasks[lastSubIndex],
                  endDate: formatLocalDate(newEnd)
                };
                updateTask({
                  ...parentTask,
                  endDate: formatLocalDate(newEnd),
                  subtasks: updatedSubtasks
                });
                return;
              }
            }

            updateTask({
              ...parentTask,
              endDate: formatLocalDate(newEnd)
            });
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragState) {
        setDragState(null);
        document.body.style.cursor = '';
        onDragEnd?.();
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, onDragEnd, pixelsPerDay, tasks, updateTask]);

  // Effect for dependency connection drawing
  useEffect(() => {
    if (!connectState) return;

    const handleConnectMouseMove = (e: MouseEvent) => {
      const rowsEl = document.querySelector('.gantt-timeline-rows');
      const rect = rowsEl?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setConnectState(prev => prev ? { ...prev, mouseX, mouseY } : null);
      }
    };

    const handleConnectMouseUp = (e: MouseEvent) => {
      const rowsEl = document.querySelector('.gantt-timeline-rows');
      const rect = rowsEl?.getBoundingClientRect();
      if (rect) {
        const mouseY = e.clientY - rect.top;
        const targetIndex = Math.floor(mouseY / 48);
        if (targetIndex >= 0 && targetIndex < rowItems.length) {
          const targetItem = rowItems[targetIndex];
          const targetTaskId = targetItem.isSubtask ? targetItem.parentId! : targetItem.id;
          
          if (targetTaskId !== connectState.fromTaskId) {
            const targetTask = tasks.find(t => t.id === targetTaskId);
            if (targetTask) {
              updateTask({
                ...targetTask,
                dependencyTaskId: connectState.fromTaskId
              });
            }
          }
        }
      }
      setConnectState(null);
    };

    window.addEventListener('mousemove', handleConnectMouseMove);
    window.addEventListener('mouseup', handleConnectMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleConnectMouseMove);
      window.removeEventListener('mouseup', handleConnectMouseUp);
    };
  }, [connectState, rowItems, tasks, updateTask]);

  // 5. Dependency Lines Calculations (Only connecting Parent Tasks)
  const taskCoords: Record<string, { xStart: number; xEnd: number; y: number; index: number }> = {};
  
  rowItems.forEach((item, index) => {
    if (!item.isSubtask) {
      const sDate = parseLocalDate(item.startDate);
      const eDate = parseLocalDate(item.endDate);
      
      const startOffset = getDaysBetween(timelineStart, sDate) * pixelsPerDay;
      const duration = getDaysBetween(sDate, eDate) + 1;
      const width = duration * pixelsPerDay;

      taskCoords[item.id] = {
        xStart: startOffset,
        xEnd: startOffset + (item.isMilestone ? 9 : width),
        y: index * 48 + 24,
        index: index
      };
    }
  });

  const renderDependencyLines = () => {
    const lines: React.ReactNode[] = [];

    tasks.forEach(t => {
      if (t.dependencyTaskId && taskCoords[t.dependencyTaskId] && taskCoords[t.id]) {
        const pred = taskCoords[t.dependencyTaskId];
        const succ = taskCoords[t.id];

        // x1, y1: End of predecessor bar
        const x1 = pred.xEnd;
        const y1 = pred.y;

        // x2, y2: Start of successor bar
        const x2 = succ.xStart;
        const y2 = succ.y;

        const predTask = tasks.find(pt => pt.id === t.dependencyTaskId);
        const isConflict = predTask && parseLocalDate(predTask.endDate) > parseLocalDate(t.startDate);

        let dPath = '';
        if (x2 > x1 + 15) {
          const midX = x1 + (x2 - x1) / 2;
          dPath = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
        } else {
          const loopOffset = 15;
          dPath = `M ${x1} ${y1} H ${x1 + loopOffset} V ${(y1 + y2) / 2} H ${x2 - loopOffset} V ${y2} H ${x2}`;
        }

        lines.push(
          <path
            key={`dep-${predTask?.id}-to-${t.id}`}
            d={dPath}
            className={`dependency-line ${isConflict ? 'warning' : ''}`}
            markerEnd="url(#arrow)"
          />
        );
      }
    });

    return lines;
  };

  const renderWeekendBackgrounds = () => {
    if (zoomLevel !== 'days') return null;
    const weekendPanels: React.ReactNode[] = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = addDays(timelineStart, i);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      if (isWeekend) {
        weekendPanels.push(
          <div
            key={`we-${i}`}
            className="weekend-shading-column"
            style={{
              position: 'absolute',
              left: `${i * pixelsPerDay}px`,
              width: `${pixelsPerDay}px`,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(239, 68, 68, 0.03)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        );
      }
    }
    return weekendPanels;
  };

  const getDurationLabel = (startDate: string, endDate: string) => {
    const duration = getDaysBetween(parseLocalDate(startDate), parseLocalDate(endDate)) + 1;
    return lang === 'uk' ? `${duration} дн.` : `${duration}d`;
  };

  return (
    <div className={`gantt-container ${showSidebar ? '' : 'sidebar-collapsed'}`}>
      {/* 1. Left GanttPRO-style task grid */}
      <div className={`gantt-sidebar gantt-grid-sidebar ${showSidebar ? '' : 'collapsed'}`}>
        <div className="gantt-grid-header">
          <div className="gantt-grid-cell gantt-grid-title-cell">
            {getTranslation(lang, 'taskTitle')}
          </div>
          <div className="gantt-grid-cell">{lang === 'uk' ? 'Початок' : 'Start'}</div>
          <div className="gantt-grid-cell">{lang === 'uk' ? 'Кінець' : 'End'}</div>
          <div className="gantt-grid-cell">{lang === 'uk' ? 'Трив.' : 'Dur.'}</div>
          <div className="gantt-grid-cell">{lang === 'uk' ? 'Прогрес' : 'Progress'}</div>
        </div>
        <div 
          className="gantt-sidebar-rows" 
          ref={sidebarRowsRef}
        >
          {rowItems.map(item => {
            const isSelected = selectedTaskId === (item.isSubtask ? item.parentId : item.id);
            return (
              <div
                key={`side-${item.id}`}
                className={`gantt-sidebar-row gantt-grid-row ${item.isSubtask ? 'gantt-sidebar-row-subtask' : ''} ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedTaskId(item.isSubtask ? item.parentId! : item.id)}
                title={item.title}
              >
                <div className="gantt-grid-cell gantt-grid-title-cell">
                  <div
                    className="gantt-task-title-wrap"
                    style={{ paddingLeft: item.isSubtask ? '24px' : '0' }}
                  >
                    {item.isGroup ? (
                      <button
                        className="gantt-collapse-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCollapse(item.id);
                        }}
                        aria-label={collapsedTasks.has(item.id) ? 'Expand task' : 'Collapse task'}
                      >
                        {collapsedTasks.has(item.id) ? '▶' : '▼'}
                      </button>
                    ) : (
                      <span className="gantt-row-indent-spacer" />
                    )}

                    <span
                      className={`gantt-row-symbol ${item.isMilestone ? 'milestone' : item.isSubtask ? 'subtask' : ''}`}
                      style={{ color: item.color || 'var(--primary)' }}
                    >
                      {item.isSubtask ? '↳' : item.isMilestone ? '◆' : '■'}
                    </span>

                    <div className="gantt-title-meta">
                      <span className="gantt-title-text" title={item.title}>
                        {item.title}
                      </span>
                      <span className="gantt-title-subline" title={item.assignee || undefined}>
                        {item.assignee || (lang === 'uk' ? 'Без виконавця' : 'Unassigned')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="gantt-grid-cell gantt-date-cell" title={formatDisplayDate(item.startDate)}>{formatDisplayDate(item.startDate)}</div>
                <div className="gantt-grid-cell gantt-date-cell" title={formatDisplayDate(item.endDate)}>{formatDisplayDate(item.endDate)}</div>
                <div className="gantt-grid-cell" title={getDurationLabel(item.startDate, item.endDate)}>{getDurationLabel(item.startDate, item.endDate)}</div>
                <div className="gantt-grid-cell">
                  <div className="gantt-progress-cell">
                    <span className={`gantt-status-dot status-${item.status}`} />
                    <span>{item.progress}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-gantt-sidebar)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={addTask} 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.78rem', 
              justifyContent: 'flex-start',
              width: '100%'
            }}
          >
            <Plus size={14} />
            {getTranslation(lang, 'addTask')}
          </button>
        </div>
      </div>

      {/* 2. Timeline Canvas */}
      <div 
        className="gantt-canvas" 
        ref={canvasRef}
        onScroll={handleCanvasScroll}
      >
        {/* Timeline Header Cells */}
        <div className="gantt-timeline-header">
          {renderHeaderCells()}
        </div>

        {/* Timeline Rows Canvas */}
        <div 
          className="gantt-timeline-rows"
          style={{ 
            width: `${totalDays * pixelsPerDay}px`,
            height: `${rowItems.length * 48}px`,
            '--grid-cell-width': zoomLevel === 'days' ? '45px' : zoomLevel === 'weeks' ? '105px' : '120px'
          } as React.CSSProperties}
        >
          {/* Shaded weekend columns */}
          {renderWeekendBackgrounds()}

          {/* Overlay SVG for drawing dependencies */}
          <svg 
            className="gantt-svg-overlay"
            width={totalDays * pixelsPerDay}
            height={rowItems.length * 48}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" />
              </marker>
            </defs>
            {renderDependencyLines()}

            {/* Render temporary drawing link line */}
            {connectState && (
              <line
                x1={connectState.fromX}
                y1={connectState.fromY}
                x2={connectState.mouseX}
                y2={connectState.mouseY}
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="4 4"
                markerEnd="url(#arrow)"
              />
            )}
          </svg>

          {/* Render Timeline Task Bars */}
          {rowItems.map((item, index) => {
            const sDate = parseLocalDate(item.startDate);
            const eDate = parseLocalDate(item.endDate);
            
            const startOffset = getDaysBetween(timelineStart, sDate) * pixelsPerDay;
            const duration = getDaysBetween(sDate, eDate) + 1;
            const width = duration * pixelsPerDay;

            const isSelected = selectedTaskId === (item.isSubtask ? item.parentId : item.id);

            return (
              <div 
                key={`row-${item.id}`} 
                className={`gantt-timeline-row ${isSelected ? 'active' : ''}`}
                style={{ width: '100%', position: 'relative' }}
              >
                {item.isMilestone ? (
                  /* Milestone Icon & Label */
                  <>
                    <div
                      className="gantt-milestone"
                      style={{
                        left: `${startOffset - 9}px`,
                        backgroundColor: item.color || 'var(--danger)',
                        borderColor: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.6)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(item.id);
                      }}
                      title={`${item.title} (${item.startDate})`}
                    />
                    <div 
                      className="gantt-milestone-label"
                      style={{
                        left: `${startOffset + 12}px`
                      }}
                    >
                      {item.title} ({formatDisplayDate(item.startDate)})
                    </div>
                  </>
                ) : item.isGroup ? (
                  /* Summary Group Task - rendered identical to standard task */
                  <div
                    className="gantt-bar-wrapper group-task-bar"
                    style={{
                      left: `${startOffset}px`,
                      width: `${width}px`,
                      backgroundColor: item.color || '#64748b',
                      border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, item, 'drag')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskId(item.id);
                    }}
                    title={getTranslation(lang, 'dragTooltip')}
                  >
                    <div className="gantt-bar">
                      <div 
                        className="gantt-bar-progress" 
                        style={{ width: `${item.progress}%`, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} 
                      />
                      {width >= 120 && (
                        <span className="gantt-bar-label">
                          {item.title} ({item.progress}%)
                        </span>
                      )}
                    </div>

                    {width < 120 && (
                      <span className="gantt-bar-label outside-label">
                        {item.title} ({item.progress}%)
                      </span>
                    )}

                    <div
                      className="gantt-resize-handle left-resize-handle"
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize-left')}
                    />
                    <div
                      className="gantt-resize-handle"
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize')}
                    />

                    {/* Dependency Dots on Hover */}
                    <div 
                      className="gantt-connector-dot left-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'left', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                    <div 
                      className="gantt-connector-dot right-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'right', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                  </div>
                ) : item.isSubtask ? (
                  /* Readable Subtask Bar with soft solid Y background and dual-end resizing */
                  <div
                    className="gantt-bar-wrapper subtask-bar"
                    style={{
                      left: `${startOffset}px`,
                      width: `${width}px`,
                      height: '24px',
                      top: '12px',
                      backgroundColor: `${item.color || '#6366f1'}22`,
                      border: `${isSelected ? 2 : 1}px solid ${item.color || 'var(--primary)'}`,
                      borderRadius: '6px',
                      boxShadow: 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, item, 'drag')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskId(item.parentId!);
                    }}
                    title={`${lang === 'uk' ? 'Підзавдання (Перетягніть для зсуву):' : 'Subtask (Drag to shift):'} ${item.title}`}
                  >
                    <div className="gantt-bar" style={{ height: '100%' }}>
                      <div 
                        className="gantt-bar-progress" 
                        style={{ width: `${item.progress}%`, backgroundColor: item.color || 'var(--primary)', opacity: 0.35 }} 
                      />
                      {width >= 120 && (
                        <span className="gantt-bar-label" style={{ fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {item.title} {item.assignee ? `(${item.assignee})` : ''}
                        </span>
                      )}
                    </div>

                    {width < 120 && (
                      <span className="gantt-bar-label outside-label" style={{ fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.title} {item.assignee ? `(${item.assignee})` : ''}
                      </span>
                    )}

                    <div
                      className="gantt-resize-handle left-resize-handle"
                      style={{ height: '100%' }}
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize-left')}
                    />
                    <div
                      className="gantt-resize-handle"
                      style={{ height: '100%' }}
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize')}
                    />

                    {/* Dependency Dots on Hover */}
                    <div 
                      className="gantt-connector-dot left-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'left', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                    <div 
                      className="gantt-connector-dot right-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'right', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                  </div>
                ) : (
                  /* Standard Task Bar with dual-end resizing */
                  <div
                    className="gantt-bar-wrapper"
                    style={{
                      left: `${startOffset}px`,
                      width: `${width}px`,
                      backgroundColor: item.color || 'var(--primary)',
                      border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, item, 'drag')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskId(item.id);
                    }}
                    title={getTranslation(lang, 'dragTooltip')}
                  >
                    <div className="gantt-bar">
                      <div 
                        className="gantt-bar-progress" 
                        style={{ width: `${item.progress}%` }} 
                      />
                      {width >= 120 && (
                        <span className="gantt-bar-label">
                          {item.title} ({item.progress}%)
                        </span>
                      )}
                    </div>

                    {width < 120 && (
                      <span className="gantt-bar-label outside-label">
                        {item.title} ({item.progress}%)
                      </span>
                    )}

                    <div
                      className="gantt-resize-handle left-resize-handle"
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize-left')}
                    />
                    <div
                      className="gantt-resize-handle"
                      onMouseDown={(e) => handleBarMouseDown(e, item, 'resize')}
                    />

                    {/* Dependency Dots on Hover */}
                    <div 
                      className="gantt-connector-dot left-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'left', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                    <div 
                      className="gantt-connector-dot right-dot" 
                      onMouseDown={(e) => handleConnectorMouseDown(e, item, 'right', startOffset, width, index)}
                      title={lang === 'uk' ? 'Перетягніть для зв\'язку' : 'Drag to link'}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
