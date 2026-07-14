import { useState, useEffect, useRef } from 'react';
import { 
  Megaphone, Globe, Compass, BookOpen, Calendar, Search, Plus, 
  Download, Upload, Languages, RotateCcw, FileText, AlertTriangle,
  Sun, Moon, Copy, Trash2, Info, X, ChevronDown, ChevronRight,
  Menu, Eye, EyeOff, Table, Users, Cloud, CloudOff, LoaderCircle
} from 'lucide-react';
import './App.css';
import type { Task, MarketingTemplate, ActiveTab, ZoomLevel, Language } from './types';
import { DEFAULT_TEMPLATES } from './data/templatesData';
import { getTranslation } from './utils/locales';

import GanttChart from './components/GanttChart';
import GridView from './components/GridView';
import KanbanBoard from './components/KanbanBoard';
import WorkloadView from './components/WorkloadView';
import TaskDetailsDrawer from './components/TaskDetailsDrawer';
import {
  ensureCloudUser,
  loadCloudState,
  saveCloudState,
  type CloudAppState,
  type CloudSyncStatus,
} from './lib/cloudMemory';

// Helper to load state from localStorage safely
const getLocalStorage = <T,>(key: string, initialValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error('Error reading localStorage key', key, error);
    return initialValue;
  }
};

function App() {
  // Theme & Language Settings
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getLocalStorage<'light' | 'dark'>('gantt_theme', 'light'));
  const [lang, setLang] = useState<Language>(() => getLocalStorage<Language>('gantt_lang', 'uk'));
  
  // Layout views & search filters
  const [activeTab, setActiveTab] = useState<ActiveTab>('gantt');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('days');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => getLocalStorage<boolean>('gantt_show_onboarding', true));
  
  // Collapsible sidebar sections
  const [templatesExpanded, setTemplatesExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);

  // Global responsive sidebar collapse states
  const [showMainSidebar, setShowMainSidebar] = useState(true);
  const [showGanttSidebar, setShowGanttSidebar] = useState(true);


  // Custom Templates/Projects list
  const [customTemplates, setCustomTemplates] = useState<MarketingTemplate[]>(() => 
    getLocalStorage<MarketingTemplate[]>('gantt_custom_templates', [])
  );
  const [hiddenDefaultTemplateIds, setHiddenDefaultTemplateIds] = useState<string[]>(() =>
    getLocalStorage<string[]>('gantt_hidden_default_templates', [])
  );
  
  // Active Project Plan id
  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => 
    getLocalStorage<string>('gantt_active_template_id', 'campaign-plan')
  );
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksTemplateId, setTasksTemplateId] = useState(activeTemplateId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('connecting');
  const cloudUserIdRef = useRef<string | null>(null);
  const cloudHydratedRef = useRef(false);
  const cloudSaveTimerRef = useRef<number | null>(null);
  const initialLocalStateRef = useRef({
    theme,
    lang,
    showOnboarding,
    customTemplates,
    hiddenDefaultTemplateIds,
    activeTemplateId,
  });
  
  // Dialog confirmation states
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/History states
  const [history, setHistory] = useState<Array<{ tasks: Task[]; labelUa: string; labelEn: string }>>([]);
  const [pendingSnapshot, setPendingSnapshot] = useState<{ tasks: Task[]; labelUa: string; labelEn: string } | null>(null);
  const [isUndoDropdownOpen, setIsUndoDropdownOpen] = useState(false);
  const lastHistoryPushTime = useRef<number>(0);

  const saveToHistory = (labelUa: string, labelEn: string, customState?: Task[]) => {
    const stateToSave = customState || tasks;
    setHistory(prev => [
      { tasks: stateToSave, labelUa, labelEn },
      ...prev
    ].slice(0, 15));
  };

  const handleUndo = (index: number = 0) => {
    if (history.length <= index) return;
    const targetState = history[index].tasks;
    setTasks(targetState);
    setHistory(prev => prev.slice(index + 1));
    setIsUndoDropdownOpen(false);
    showToast(lang === 'uk' ? 'Дію скасовано' : 'Action undone', 'success');
  };

  const handleDragStart = () => {
    setPendingSnapshot({
      tasks: [...tasks],
      labelUa: lang === 'uk' ? 'Зміна дат на графіку' : 'Shifted dates on chart',
      labelEn: 'Shifted dates on chart'
    });
  };

  const handleDragEnd = () => {
    if (pendingSnapshot) {
      if (JSON.stringify(pendingSnapshot.tasks) !== JSON.stringify(tasks)) {
        setHistory(prev => [
          { tasks: pendingSnapshot.tasks, labelUa: pendingSnapshot.labelUa, labelEn: pendingSnapshot.labelEn },
          ...prev
        ].slice(0, 15));
      }
      setPendingSnapshot(null);
    }
  };

  // Sync Theme to HTML Element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
    localStorage.setItem('gantt_theme', JSON.stringify(theme));
  }, [theme]);

  // Combine Default & Custom plans
  const visibleDefaultTemplates = DEFAULT_TEMPLATES.filter(
    template => !hiddenDefaultTemplateIds.includes(template.id),
  );
  const allTemplates = [...visibleDefaultTemplates, ...customTemplates];
  const activeTemplate = allTemplates.find(t => t.id === activeTemplateId) || allTemplates[0] || DEFAULT_TEMPLATES[0];

  // Load tasks when activeTemplateId changes
  useEffect(() => {
    const savedTasks = localStorage.getItem(`gantt_tasks_${activeTemplateId}`);
    let nextTasks = activeTemplate.tasks;
    if (savedTasks) {
      try {
        nextTasks = JSON.parse(savedTasks);
      } catch {
        nextTasks = activeTemplate.tasks;
      }
    }
    setTasks(nextTasks);
    setTasksTemplateId(activeTemplateId);
    localStorage.setItem('gantt_active_template_id', JSON.stringify(activeTemplateId));
    setSelectedTaskId(null);
    setHistory([]); // Reset undo history stack on project swap
  }, [activeTemplateId, activeTemplate.tasks]);

  // Save tasks to localStorage on task changes
  useEffect(() => {
    if (tasks.length > 0 || activeTemplateId.startsWith('custom_blank_')) {
      localStorage.setItem(`gantt_tasks_${activeTemplateId}`, JSON.stringify(tasks));
    }
  }, [tasks, activeTemplateId]);

  // Save changes to custom templates definitions
  useEffect(() => {
    localStorage.setItem('gantt_custom_templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  useEffect(() => {
    localStorage.setItem('gantt_hidden_default_templates', JSON.stringify(hiddenDefaultTemplateIds));
  }, [hiddenDefaultTemplateIds]);

  // Save Language changes
  useEffect(() => {
    localStorage.setItem('gantt_lang', JSON.stringify(lang));
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('gantt_show_onboarding', JSON.stringify(showOnboarding));
  }, [showOnboarding]);

  // Restore cloud state, or migrate all existing local data on first connection.
  useEffect(() => {
    let cancelled = false;

    const hydrateCloudMemory = async () => {
      setCloudStatus('connecting');
      try {
        const userId = await ensureCloudUser();
        const cloudState = await loadCloudState(userId);
        if (cancelled) return;

        cloudUserIdRef.current = userId;

        if (cloudState) {
          Object.entries(cloudState.tasksByTemplate).forEach(([templateId, templateTasks]) => {
            localStorage.setItem(`gantt_tasks_${templateId}`, JSON.stringify(templateTasks));
          });
          localStorage.setItem('gantt_theme', JSON.stringify(cloudState.theme));
          localStorage.setItem('gantt_lang', JSON.stringify(cloudState.lang));
          localStorage.setItem('gantt_show_onboarding', JSON.stringify(cloudState.showOnboarding));
          localStorage.setItem('gantt_custom_templates', JSON.stringify(cloudState.customTemplates));
          const restoredHiddenDefaultTemplateIds = cloudState.hiddenDefaultTemplateIds ?? [];
          localStorage.setItem('gantt_hidden_default_templates', JSON.stringify(restoredHiddenDefaultTemplateIds));
          localStorage.setItem('gantt_active_template_id', JSON.stringify(cloudState.activeTemplateId));

          const restoredTemplates = [
            ...DEFAULT_TEMPLATES.filter(template => !restoredHiddenDefaultTemplateIds.includes(template.id)),
            ...cloudState.customTemplates,
          ];
          const fallbackTemplate = restoredTemplates[0] ?? DEFAULT_TEMPLATES[0];
          const restoredTemplateId = restoredTemplates.some(t => t.id === cloudState.activeTemplateId)
            ? cloudState.activeTemplateId
            : fallbackTemplate.id;
          const restoredTasks = cloudState.tasksByTemplate[restoredTemplateId]
            ?? restoredTemplates.find(t => t.id === restoredTemplateId)?.tasks
            ?? fallbackTemplate.tasks;

          setTheme(cloudState.theme);
          setLang(cloudState.lang);
          setShowOnboarding(cloudState.showOnboarding);
          setCustomTemplates(cloudState.customTemplates);
          setHiddenDefaultTemplateIds(restoredHiddenDefaultTemplateIds);
          setActiveTemplateId(restoredTemplateId);
          setTasks(restoredTasks);
          setTasksTemplateId(restoredTemplateId);
        } else {
          const initial = initialLocalStateRef.current;
          const localTemplates = [
            ...DEFAULT_TEMPLATES.filter(template => !initial.hiddenDefaultTemplateIds.includes(template.id)),
            ...initial.customTemplates,
          ];
          const tasksByTemplate = Object.fromEntries(
            localTemplates.map(template => {
              const stored = getLocalStorage<Task[] | null>(`gantt_tasks_${template.id}`, null);
              return [template.id, stored ?? template.tasks];
            }),
          );
          const localState: CloudAppState = {
            version: 1,
            theme: initial.theme,
            lang: initial.lang,
            showOnboarding: initial.showOnboarding,
            customTemplates: initial.customTemplates,
            hiddenDefaultTemplateIds: initial.hiddenDefaultTemplateIds,
            activeTemplateId: initial.activeTemplateId,
            tasksByTemplate,
          };
          await saveCloudState(userId, localState);
          if (cancelled) return;
        }

        cloudHydratedRef.current = true;
        setCloudStatus('synced');
      } catch (error) {
        console.error('Cloud memory initialization failed', error);
        if (!cancelled) setCloudStatus('error');
      }
    };

    void hydrateCloudMemory();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce writes so rapid task edits become one atomic cloud update.
  useEffect(() => {
    const userId = cloudUserIdRef.current;
    if (!cloudHydratedRef.current || !userId || tasksTemplateId !== activeTemplateId) return;

    if (cloudSaveTimerRef.current !== null) {
      window.clearTimeout(cloudSaveTimerRef.current);
    }

    setCloudStatus('saving');
    cloudSaveTimerRef.current = window.setTimeout(() => {
      const templates = [
        ...DEFAULT_TEMPLATES.filter(template => !hiddenDefaultTemplateIds.includes(template.id)),
        ...customTemplates,
      ];
      const tasksByTemplate = Object.fromEntries(
        templates.map(template => {
          if (template.id === activeTemplateId) return [template.id, tasks];
          const stored = getLocalStorage<Task[] | null>(`gantt_tasks_${template.id}`, null);
          return [template.id, stored ?? template.tasks];
        }),
      );
      const nextState: CloudAppState = {
        version: 1,
        theme,
        lang,
        showOnboarding,
        customTemplates,
        hiddenDefaultTemplateIds,
        activeTemplateId,
        tasksByTemplate,
      };

      void saveCloudState(userId, nextState)
        .then(() => setCloudStatus('synced'))
        .catch((error) => {
          console.error('Cloud memory save failed', error);
          setCloudStatus('error');
        });
    }, 700);

    return () => {
      if (cloudSaveTimerRef.current !== null) {
        window.clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [activeTemplateId, customTemplates, hiddenDefaultTemplateIds, lang, showOnboarding, tasks, tasksTemplateId, theme]);

  // Toast notifier helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTemplateSelect = (id: string) => {
    setActiveTemplateId(id);
  };

  // Add Task
  const handleAddTask = (status: Task['status'] = 'todo') => {
    saveToHistory(
      lang === 'uk' ? 'Додано нове завдання' : 'Added new task',
      'Added new task'
    );

    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    const end = targetDate.toISOString().split('T')[0];

    const newTask: Task = {
      id: `task_${Date.now()}`,
      title: lang === 'uk' ? 'Нове завдання' : 'New Task',
      description: '',
      startDate: today,
      endDate: end,
      progress: 0,
      status: status,
      assignee: 'Anna',
      isMilestone: false,
      color: '#6366f1',
      subtasks: [],
      comments: []
    };
    
    setTasks(prev => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
  };

  // Clone/Duplicate Task
  const handleCloneTask = (taskId: string) => {
    saveToHistory(
      lang === 'uk' ? 'Здубльовано завдання' : 'Duplicated task',
      'Duplicated task'
    );

    const origIndex = tasks.findIndex(t => t.id === taskId);
    if (origIndex === -1) return;
    const orig = tasks[origIndex];

    const clonedTask: Task = {
      ...orig,
      id: `task_clone_${Date.now()}`,
      title: `${orig.title} (${lang === 'uk' ? 'Копія' : 'Copy'})`,
      comments: [], // Start comments fresh
      subtasks: orig.subtasks ? orig.subtasks.map(s => ({ ...s, id: `sub_clone_${Math.random()}`, completed: false })) : []
    };

    // Insert cloned task right next to original
    const newTasksList = [...tasks];
    newTasksList.splice(origIndex + 1, 0, clonedTask);
    
    setTasks(newTasksList);
    setSelectedTaskId(clonedTask.id);
    showToast(lang === 'uk' ? 'Завдання дубльовано!' : 'Task duplicated!', 'success');
  };

  // Smart Recursive Dependency Auto-Scheduling Logic
  const autoScheduleTasks = (updatedTasks: Task[], changedTaskId: string): Task[] => {
    const list = [...updatedTasks];
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

    const queue = [changedTaskId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentTask = list.find(t => t.id === currentId);
      if (!currentTask) continue;

      const currentEnd = parseLocalDate(currentTask.endDate);
      const successors = list.filter(t => t.dependencyTaskId === currentId);

      successors.forEach(succ => {
        const succStart = parseLocalDate(succ.startDate);
        // Successor must start at least 1 day after predecessor ends
        if (succStart.getTime() <= currentEnd.getTime()) {
          const requiredStart = addDays(currentEnd, 1);
          const duration = getDaysBetween(succStart, parseLocalDate(succ.endDate));
          const newEnd = addDays(requiredStart, duration);

          const succIndex = list.findIndex(t => t.id === succ.id);
          if (succIndex !== -1) {
            list[succIndex] = {
              ...list[succIndex],
              startDate: formatLocalDate(requiredStart),
              endDate: formatLocalDate(newEnd)
            };
            queue.push(succ.id);
          }
        }
      });
    }
    return list;
  };

  // Synchronize parent task dates to span all its subtasks
  const syncParentTaskDates = (task: Task): Task => {
    if (!task.subtasks || task.subtasks.length === 0) return task;
    const subtasksWithDates = task.subtasks.filter(s => s.startDate && s.endDate);
    if (subtasksWithDates.length === 0) return task;

    const startTimes = subtasksWithDates.map(s => {
      const [y, m, d] = s.startDate!.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    });
    const endTimes = subtasksWithDates.map(s => {
      const [y, m, d] = s.endDate!.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    });

    const minTime = Math.min(...startTimes);
    const maxTime = Math.max(...endTimes);

    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      ...task,
      startDate: formatLocalDate(new Date(minTime)),
      endDate: formatLocalDate(new Date(maxTime))
    };
  };

  // Update single Task with auto-scheduling recalculation and parent task date synchronization
  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => {
      const syncedTask = syncParentTaskDates(updatedTask);
      const replaced = prev.map(t => t.id === syncedTask.id ? syncedTask : t);
      
      // Save details changes to history with a rate limit to group keystrokes
      if (!pendingSnapshot) {
        const now = Date.now();
        if (now - lastHistoryPushTime.current > 1500) {
          saveToHistory(
            lang === 'uk' ? 'Оновлено деталі завдання' : 'Updated task details',
            'Updated task details',
            prev
          );
          lastHistoryPushTime.current = now;
        }
      }

      return autoScheduleTasks(replaced, syncedTask.id);
    });
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    saveToHistory(
      lang === 'uk' ? 'Видалено завдання' : 'Deleted task',
      'Deleted task'
    );

    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
    showToast(lang === 'uk' ? 'Завдання видалено' : 'Task deleted', 'success');
  };

  // Reset current template tasks
  const handleResetTemplate = () => {
    saveToHistory(
      lang === 'uk' ? 'Скинуто шаблон до початкових' : 'Reset template to default',
      'Reset template to default'
    );

    setTasks(activeTemplate.tasks);
    localStorage.removeItem(`gantt_tasks_${activeTemplateId}`);
    setIsResetConfirmOpen(false);
    setSelectedTaskId(null);
    showToast(lang === 'uk' ? 'Дані скинуто до початкових' : 'Template reset to default');
  };

  // 1. CREATE Blank Project Plan
  const handleCreateBlankPlan = () => {
    const titlePrompt = prompt(
      lang === 'uk' 
        ? 'Введіть назву для нового пустого плану:' 
        : 'Enter a name for the new blank plan:',
      lang === 'uk' ? 'Новий маркетинговий план' : 'New Marketing Plan'
    );

    if (!titlePrompt) return;

    const newPlanId = `custom_blank_${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    const newPlan: MarketingTemplate = {
      id: newPlanId,
      titleUa: titlePrompt,
      titleEn: titlePrompt,
      categoryUa: lang === 'uk' ? 'Власний проект' : 'Custom Project',
      categoryEn: lang === 'uk' ? 'Власний проект' : 'Custom Project',
      descriptionUa: lang === 'uk' ? 'Створений користувачем пустий план.' : 'User-created blank plan.',
      descriptionEn: lang === 'uk' ? 'Створений користувачем пустий план.' : 'User-created blank plan.',
      iconName: 'Compass',
      tasks: [
        {
          id: `task_${Date.now()}`,
          title: lang === 'uk' ? 'Початкове завдання' : 'Initial Task',
          description: lang === 'uk' ? 'Перше завдання вашого плану' : 'First task of your plan',
          startDate: today,
          endDate: today,
          progress: 0,
          status: 'todo',
          assignee: 'Anna',
          isMilestone: false,
          color: '#6366f1',
          subtasks: [],
          comments: []
        }
      ]
    };

    setCustomTemplates(prev => [...prev, newPlan]);
    setActiveTemplateId(newPlanId);
    showToast(lang === 'uk' ? 'Створено пустий план!' : 'Blank plan created!', 'success');
  };

  // 2. DUPLICATE Active Project Plan
  const handleDuplicateActivePlan = () => {
    const activeTitle = activeTemplate[`title${lang === 'uk' ? 'Ua' : 'En'}` as keyof MarketingTemplate];
    const newTitle = prompt(
      lang === 'uk' 
        ? 'Введіть назву для копії плану:' 
        : 'Enter a name for the plan duplicate:',
      `${activeTitle} (${lang === 'uk' ? 'Копія' : 'Copy'})`
    );

    if (!newTitle) return;

    const duplicateId = `custom_clone_${Date.now()}`;
    const duplicatePlan: MarketingTemplate = {
      id: duplicateId,
      titleUa: newTitle,
      titleEn: newTitle,
      categoryUa: lang === 'uk' ? 'Власний проект' : 'Custom Project',
      categoryEn: lang === 'uk' ? 'Власний project' : 'Custom Project',
      descriptionUa: activeTemplate.descriptionUa,
      descriptionEn: activeTemplate.descriptionEn,
      iconName: activeTemplate.iconName,
      tasks: tasks.map(t => ({
        ...t,
        id: `task_dup_${t.id}_${Math.random().toString(36).substr(2, 5)}`,
        comments: [], // fresh comments
        subtasks: t.subtasks ? t.subtasks.map(s => ({ ...s, id: `sub_dup_${Math.random()}` })) : []
      }))
    };

    // Re-resolve dependencies matching inside the duplicated list
    const originalIds = tasks.map(t => t.id);
    duplicatePlan.tasks.forEach(t => {
      if (t.dependencyTaskId) {
        const origPredIndex = originalIds.indexOf(t.dependencyTaskId);
        if (origPredIndex !== -1) {
          t.dependencyTaskId = duplicatePlan.tasks[origPredIndex].id;
        }
      }
    });

    setCustomTemplates(prev => [...prev, duplicatePlan]);
    setActiveTemplateId(duplicateId);
    showToast(lang === 'uk' ? 'План успішно здубльовано!' : 'Plan successfully duplicated!', 'success');
  };

  // 3. DELETE Project Plan
  const handleDeletePlan = (templateId: string) => {
    if (allTemplates.length <= 1) {
      alert(lang === 'uk' ? 'Не можна видалити останній шаблон.' : 'You cannot delete the last template.');
      return;
    }

    const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    const template = defaultTemplate ?? customTemplates.find(t => t.id === templateId);
    if (!template) return;

    const templateTitle = lang === 'uk' ? template.titleUa : template.titleEn;
    const confirmDel = confirm(`${getTranslation(lang, 'confirmDeletePlan')}\n\n${templateTitle}`);
    if (!confirmDel) return;

    if (defaultTemplate) {
      setHiddenDefaultTemplateIds(prev => prev.includes(templateId) ? prev : [...prev, templateId]);
    } else {
      setCustomTemplates(prev => prev.filter(t => t.id !== templateId));
    }
    localStorage.removeItem(`gantt_tasks_${templateId}`);

    if (activeTemplateId === templateId) {
      const nextTemplate = allTemplates.find(t => t.id !== templateId);
      if (nextTemplate) setActiveTemplateId(nextTemplate.id);
    }
    showToast(lang === 'uk' ? 'Шаблон видалено' : 'Template deleted', 'success');
  };

  const handleDeleteActivePlan = () => handleDeletePlan(activeTemplateId);

  // Save current plan state as a custom template
  const handleSaveAsTemplate = () => {
    const titlePrompt = prompt(
      lang === 'uk' 
        ? 'Введіть назву для вашого шаблону:' 
        : 'Enter a name for your custom template:',
      `${activeTemplate[`title${lang === 'uk' ? 'Ua' : 'En'}` as keyof MarketingTemplate]} - Копія`
    );

    if (!titlePrompt) return;

    const newTemplateId = `custom_${Date.now()}`;
    const newCustomTemplate: MarketingTemplate = {
      id: newTemplateId,
      titleUa: titlePrompt,
      titleEn: titlePrompt,
      categoryUa: lang === 'uk' ? 'Власний шаблон' : 'Custom Template',
      categoryEn: lang === 'uk' ? 'Власний Template' : 'Custom Template',
      descriptionUa: lang === 'uk' ? 'Створений користувачем шаблон.' : 'User-created custom template.',
      descriptionEn: lang === 'uk' ? 'Створений користувачем шаблон.' : 'User-created custom template.',
      iconName: activeTemplate.iconName,
      tasks: [...tasks]
    };

    const updatedCustoms = [...customTemplates, newCustomTemplate];
    setCustomTemplates(updatedCustoms);
    
    setActiveTemplateId(newTemplateId);
    showToast(getTranslation(lang, 'customTemplateSaved'), 'success');
  };

  // Onboarding dismiss helper
  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('gantt_show_onboarding', 'false');
  };

  // Export tasks as JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeTemplateId}_plan_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export tasks as CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Assignee', 'Start Date', 'End Date', 'Progress %', 'Status', 'Milestone', 'Dependency'];
    const rows = tasks.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.assignee,
      t.startDate,
      t.endDate,
      t.progress,
      t.status,
      t.isMilestone ? 'TRUE' : 'FALSE',
      t.dependencyTaskId || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `${activeTemplateId}_plan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import tasks from JSON
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTasks = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedTasks)) {
          const isValid = importedTasks.every(t => t.id && t.title && t.startDate && t.endDate);
          if (isValid) {
            setTasks(importedTasks);
            showToast(getTranslation(lang, 'importSuccess'), 'success');
          } else {
            showToast(getTranslation(lang, 'importError'), 'error');
          }
        } else {
          showToast(getTranslation(lang, 'importError'), 'error');
        }
      } catch {
        showToast(getTranslation(lang, 'importError'), 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter tasks by query, assignee, and status
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.assignee.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssignee = filterAssignee === 'all' || t.assignee === filterAssignee;
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesAssignee && matchesStatus;
  });

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const averageProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + (task.isMilestone ? 0 : task.progress), 0) / tasks.length)
    : 0;
  const activeTemplateTitle = lang === 'uk' ? activeTemplate.titleUa : activeTemplate.titleEn;
  const activeTemplateDescription = lang === 'uk' ? activeTemplate.descriptionUa : activeTemplate.descriptionEn;
  const activeFiltersCount = [
    searchQuery.trim() ? 'search' : null,
    filterAssignee !== 'all' ? 'assignee' : null,
    filterStatus !== 'all' ? 'status' : null
  ].filter(Boolean).length;

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  const renderTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Megaphone': return <Megaphone size={16} />;
      case 'Globe': return <Globe size={16} />;
      case 'Compass': return <Compass size={16} />;
      case 'BookOpen': return <BookOpen size={16} />;
      case 'Calendar': return <Calendar size={16} />;
      default: return <FileText size={16} />;
    }
  };

  // Handle Responsive Viewport Logic
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowMainSidebar(false);
        setShowGanttSidebar(false);
      } else {
        setShowMainSidebar(true);
        setShowGanttSidebar(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${showMainSidebar ? '' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">G</div>
          <div className="brand-info">
            <h2>{getTranslation(lang, 'appTitle')}</h2>
            <p>{getTranslation(lang, 'appSubtitle')}</p>
          </div>
        </div>

        <div className="sidebar-content">
          <div>
            <h3 className="sidebar-section-title sidebar-section-toggle" onClick={() => setTemplatesExpanded(e => !e)}>
              {templatesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{getTranslation(lang, 'templatesTitle')}</span>
            </h3>
            {templatesExpanded && (
              <div className="template-list">
                {visibleDefaultTemplates.map(t => (
                  <div className="template-row" key={t.id}>
                    <button
                      className={`template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(t.id)}
                    >
                      <div className="template-icon-wrapper">
                        {renderTemplateIcon(t.iconName)}
                      </div>
                      <div className="template-details">
                        <h4>{lang === 'uk' ? t.titleUa : t.titleEn}</h4>
                        <span>{lang === 'uk' ? t.categoryUa : t.categoryEn}</span>
                      </div>
                    </button>
                    <button
                      className="template-delete-btn"
                      onClick={() => handleDeletePlan(t.id)}
                      title={getTranslation(lang, 'deletePlan')}
                      aria-label={`${getTranslation(lang, 'deletePlan')}: ${lang === 'uk' ? t.titleUa : t.titleEn}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="sidebar-section-title sidebar-section-heading">
              <span className="sidebar-section-toggle" onClick={() => setCustomExpanded(e => !e)}>
                {customExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{getTranslation(lang, 'customTemplates')}</span>
              </span>
              <button 
                onClick={handleCreateBlankPlan}
                className="section-add-btn"
                title={getTranslation(lang, 'createPlan')}
              >
                <Plus size={16} />
              </button>
            </h3>
            
            {customExpanded && (
              <div className="template-list">
                {customTemplates.map(t => (
                  <div className="template-row" key={t.id}>
                    <button
                      className={`template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(t.id)}
                    >
                      <div className="template-icon-wrapper">
                        {renderTemplateIcon(t.iconName)}
                      </div>
                      <div className="template-details">
                        <h4>{t.titleUa}</h4>
                        <span>{lang === 'uk' ? t.categoryUa : t.categoryEn}</span>
                      </div>
                    </button>
                    <button
                      className="template-delete-btn"
                      onClick={() => handleDeletePlan(t.id)}
                      title={getTranslation(lang, 'deletePlan')}
                      aria-label={`${getTranslation(lang, 'deletePlan')}: ${lang === 'uk' ? t.titleUa : t.titleEn}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                
                {customTemplates.length === 0 && (
                  <div className="empty-mini">
                    {lang === 'uk' ? 'Створіть свій план' : 'Create your plan'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-actions">
          <div className="sidebar-actions-row">
            <button className="btn btn-secondary btn-compact" onClick={handleDuplicateActivePlan} title={getTranslation(lang, 'duplicatePlan')}>
              <Copy size={14} />
              <span>{lang === 'uk' ? 'Дублювати' : 'Duplicate'}</span>
            </button>
            
            {allTemplates.length > 1 && (
              <button className="btn btn-danger btn-square" onClick={handleDeleteActivePlan} title={getTranslation(lang, 'deletePlan')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <button className="btn btn-secondary" onClick={handleSaveAsTemplate}>
            <Plus size={15} />
            {getTranslation(lang, 'addCustomTemplate')}
          </button>
          
          <button className="btn btn-danger" onClick={() => setIsResetConfirmOpen(true)}>
            <RotateCcw size={15} />
            {getTranslation(lang, 'resetTemplate')}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-workspace">
        <header className="header">
          <div className="header-left">
            <button
              className="btn-icon"
              onClick={() => setShowMainSidebar(!showMainSidebar)}
              title={lang === 'uk' ? 'Показати/Сховати панель проектів' : 'Toggle Projects Sidebar'}
            >
              <Menu size={16} />
            </button>

            <div className="view-tabs">
              {(['gantt', 'grid', 'kanban', 'workload'] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  className={`view-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'gantt' && <Calendar size={14} />}
                  {tab === 'grid' && <Table size={14} />}
                  {tab === 'kanban' && <Compass size={14} />}
                  {tab === 'workload' && <Users size={14} />}
                  <span className="hide-mobile-text">
                    {getTranslation(lang, `view${tab.charAt(0).toUpperCase() + tab.slice(1)}` as any)}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === 'gantt' && (
              <div className="controls-group gantt-controls">
                <button
                  className={`btn btn-secondary btn-compact ${showGanttSidebar ? 'active' : ''}`}
                  onClick={() => setShowGanttSidebar(!showGanttSidebar)}
                  title={lang === 'uk' ? 'Показати/Сховати список завдань' : 'Toggle Gantt Tasks List'}
                >
                  {showGanttSidebar ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{lang === 'uk' ? 'Завдання' : 'Tasks'}</span>
                </button>

                <span className="control-label">{getTranslation(lang, 'zoomLabel')}</span>
                <div className="view-tabs">
                  {(['days', 'weeks', 'months'] as ZoomLevel[]).map(lvl => (
                    <button
                      key={lvl}
                      className={`view-tab ${zoomLevel === lvl ? 'active' : ''}`}
                      onClick={() => setZoomLevel(lvl)}
                    >
                      {getTranslation(lang, lvl as any)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="header-right">
            <div className="search-container">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder={getTranslation(lang, 'searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="controls-group">
              <select
                className="header-filter-select"
                value={filterAssignee}
                onChange={e => setFilterAssignee(e.target.value)}
                title={lang === 'uk' ? 'Фільтр за виконавцем' : 'Filter by Assignee'}
              >
                <option value="all">{lang === 'uk' ? 'Всі виконавці' : 'All Assignees'}</option>
                <option value="Anna">Anna</option>
                <option value="Bogdan">Bogdan</option>
                <option value="Olena">Olena</option>
                <option value="Yuri">Yuri</option>
              </select>

              <select
                className="header-filter-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                title={lang === 'uk' ? 'Фільтр за статусом' : 'Filter by Status'}
              >
                <option value="all">{lang === 'uk' ? 'Всі статуси' : 'All Statuses'}</option>
                <option value="todo">{getTranslation(lang, 'todo')}</option>
                <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                <option value="done">{getTranslation(lang, 'done')}</option>
              </select>
            </div>

            <div className="controls-group">
              <button
                className={`btn-icon cloud-sync-status cloud-sync-${cloudStatus}`}
                disabled
                title={
                  cloudStatus === 'synced'
                    ? (lang === 'uk' ? 'Збережено у Supabase' : 'Saved to Supabase')
                    : cloudStatus === 'saving'
                      ? (lang === 'uk' ? 'Збереження у Supabase…' : 'Saving to Supabase…')
                      : cloudStatus === 'error'
                        ? (lang === 'uk' ? 'Хмарна пам’ять недоступна' : 'Cloud memory unavailable')
                        : (lang === 'uk' ? 'Підключення до Supabase…' : 'Connecting to Supabase…')
                }
              >
                {cloudStatus === 'synced' && <Cloud size={16} />}
                {(cloudStatus === 'connecting' || cloudStatus === 'saving') && <LoaderCircle size={16} />}
                {cloudStatus === 'error' && <CloudOff size={16} />}
              </button>

              {/* Theme Toggle */}
              <button 
                className="btn-icon" 
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                title={getTranslation(lang, 'themeToggle')}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              <button className="btn-icon" onClick={handleExportJSON} title={getTranslation(lang, 'exportProject')}>
                <Download size={16} />
              </button>
              
              <button className="btn-icon" onClick={handleExportCSV} title={getTranslation(lang, 'exportCsv')}>
                <FileText size={16} />
              </button>
              
              <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title={getTranslation(lang, 'importProject')}>
                <Upload size={16} />
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={handleImportJSON}
                />
              </button>
              
              {/* Undo / History Dropdown */}
              <div className="undo-dropdown-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button 
                  className="btn-icon"
                  onClick={() => handleUndo(0)}
                  disabled={history.length === 0}
                  style={{ 
                    opacity: history.length === 0 ? 0.4 : 1, 
                    cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: '1px solid var(--border-color)'
                  }}
                  title={lang === 'uk' ? `Скасувати останню дію` : `Undo last action`}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => setIsUndoDropdownOpen(!isUndoDropdownOpen)}
                  disabled={history.length === 0}
                  style={{
                    opacity: history.length === 0 ? 0.4 : 1,
                    cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    padding: '0 4px',
                    width: '18px'
                  }}
                  title={lang === 'uk' ? 'Історія останніх 5 дій' : 'History of last 5 actions'}
                >
                  <ChevronDown size={12} />
                </button>

                {isUndoDropdownOpen && history.length > 0 && (
                  <>
                    <div className="undo-dropdown-overlay" onClick={() => setIsUndoDropdownOpen(false)} />
                    <div className="undo-dropdown-menu">
                      <div className="undo-dropdown-header">
                        {lang === 'uk' ? 'Скасувати дії:' : 'Revert actions:'}
                      </div>
                      {history.slice(0, 5).map((entry, idx) => (
                        <button
                          key={`undo-${idx}`}
                          className="undo-dropdown-item"
                          onClick={() => handleUndo(idx)}
                        >
                          <span className="undo-idx">{idx + 1}.</span>
                          <span className="undo-label">{lang === 'uk' ? entry.labelUa : entry.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button 
                className="btn-icon lang-toggle" 
                onClick={() => setLang(l => l === 'uk' ? 'en' : 'uk')}
                title="Змінити мову / Change Language"
              >
                <Languages size={16} />
              </button>
            </div>
          </div>
        </header>

        {activeTab !== 'gantt' && (
          <section className="project-summary">
            <div className="project-title-block">
              <p className="eyebrow">{lang === 'uk' ? 'Поточний план' : 'Current plan'}</p>
              <h1>{activeTemplateTitle}</h1>
              <p>{activeTemplateDescription}</p>
            </div>

            <div className="summary-stats">
              <div className="summary-stat">
                <span>{lang === 'uk' ? 'Завдань' : 'Tasks'}</span>
                <strong>{tasks.length}</strong>
              </div>
              <div className="summary-stat">
                <span>{lang === 'uk' ? 'Виконано' : 'Done'}</span>
                <strong>{completedTasks}</strong>
              </div>
              <div className="summary-stat">
                <span>{lang === 'uk' ? 'Прогрес' : 'Progress'}</span>
                <strong>{averageProgress}%</strong>
              </div>
              <div className="summary-stat">
                <span>{lang === 'uk' ? 'Показано' : 'Shown'}</span>
                <strong>{filteredTasks.length}</strong>
              </div>
            </div>
          </section>
        )}

        {activeFiltersCount > 0 && (
          <div className="filter-note">
            <span>
              {lang === 'uk'
                ? `Активні фільтри: ${activeFiltersCount}. Показано ${filteredTasks.length} з ${tasks.length} завдань.`
                : `Active filters: ${activeFiltersCount}. Showing ${filteredTasks.length} of ${tasks.length} tasks.`}
            </span>
            <button
              className="btn btn-secondary btn-compact"
              onClick={() => {
                setSearchQuery('');
                setFilterAssignee('all');
                setFilterStatus('all');
              }}
            >
              <X size={14} />
              {lang === 'uk' ? 'Очистити' : 'Clear'}
            </button>
          </div>
        )}

        {/* View Switcher Content */}
        <div className="content-area">
          {activeTab === 'gantt' && (
            <GanttChart
              tasks={filteredTasks}
              updateTask={handleUpdateTask}
              selectedTaskId={selectedTaskId}
              setSelectedTaskId={setSelectedTaskId}
              zoomLevel={zoomLevel}
              lang={lang}
              addTask={() => handleAddTask('todo')}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              showSidebar={showGanttSidebar}
            />
          )}

          {activeTab === 'grid' && (
            <GridView
              tasks={filteredTasks}
              updateTask={handleUpdateTask}
              addTask={handleAddTask}
              cloneTask={handleCloneTask}
              deleteTask={handleDeleteTask}
              setSelectedTaskId={setSelectedTaskId}
              lang={lang}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard
              tasks={filteredTasks}
              updateTask={handleUpdateTask}
              setSelectedTaskId={setSelectedTaskId}
              lang={lang}
              addTask={handleAddTask}
            />
          )}

          {activeTab === 'workload' && (
            <WorkloadView
              tasks={filteredTasks}
              lang={lang}
            />
          )}
        </div>

        {/* Onboarding bottom advice panel */}
        {showOnboarding && (
          <div className="onboarding-hint-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>{getTranslation(lang, 'onboardingHint')}</span>
            </span>
            <button className="onboarding-close-btn" onClick={handleDismissOnboarding}>
              <X size={15} />
            </button>
          </div>
        )}
      </main>

      {/* Task Edit Side Drawer */}
      {selectedTask && (
        <TaskDetailsDrawer
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdateTask}
          onClone={handleCloneTask}
          onDelete={handleDeleteTask}
          tasks={tasks}
          lang={lang}
        />
      )}

      {/* Confirmation Reset Modal */}
      {isResetConfirmOpen && (
        <>
          <div className="dialog-backdrop" onClick={() => setIsResetConfirmOpen(false)} />
          <div className="dialog-container">
            <div className="dialog-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={20} />
                {getTranslation(lang, 'resetTemplate')}
              </span>
            </div>
            <div className="dialog-body">
              {getTranslation(lang, 'templateResetAlert')}
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setIsResetConfirmOpen(false)}>
                {getTranslation(lang, 'cancel')}
              </button>
              <button className="btn btn-primary" style={{ backgroundColor: 'var(--danger)' }} onClick={handleResetTemplate}>
                {getTranslation(lang, 'resetTemplate')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '60px', // slightly offset above hint bar
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 999,
          fontSize: '0.85rem',
          fontWeight: 600,
          backdropFilter: 'blur(4px)',
          animation: 'pulse 1.5s infinite'
        }}>
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}

export default App;
