import { useState, useEffect, useRef, useCallback, useMemo, type SetStateAction, type TouchEvent as ReactTouchEvent } from 'react';
import { 
  Megaphone, Globe, Compass, BookOpen, Calendar, Search, Plus, 
  Download, Upload, Languages, RotateCcw, FileText, AlertTriangle,
  Sun, Moon, Copy, Trash2, Info, X, ChevronDown, ChevronRight,
  Menu, Eye, EyeOff, Table, Users, Cloud, CloudOff, LoaderCircle, Pencil,
  Archive, CalendarRange, MoreHorizontal, SlidersHorizontal, FolderOpen, LogOut, CircleUserRound,
  Share2, Lock, UserPlus, Shield, Smartphone, Bell, Lightbulb
} from 'lucide-react';
import './App.css';
import type { Task, MarketingTemplate, ActiveTab, ZoomLevel, Language, TeamMember, Reminder, Idea } from './types';
import { DEFAULT_TEMPLATES, TEAM_MEMBERS } from './data/templatesData';
import { getTranslation } from './utils/locales';

import GanttChart from './components/GanttChart';
import GridView from './components/GridView';
import KanbanBoard from './components/KanbanBoard';
import WorkloadView from './components/WorkloadView';
import TaskDetailsDrawer from './components/TaskDetailsDrawer';
import PlansCalendarView, { type PlanCalendarItem } from './components/PlansCalendarView';
import TodayPanel, { type TodayPlanGroup } from './components/TodayPanel';
import MobileTaskList from './components/MobileTaskList';
import MobilePlansView from './components/MobilePlansView';
import ReminderCenter, { type ReminderPlanOption, type ReminderTargetDraft } from './components/ReminderCenter';
import ReminderAlert from './components/ReminderAlert';
import IdeasDialog from './components/IdeasDialog';
import { playReminderSound, unlockReminderSound } from './lib/reminderSound';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
  syncPushReminders,
  type PushNotificationStatus,
} from './lib/pushNotifications';
import {
  ensureCloudUser,
  loadCloudState,
  saveCloudState,
  type CloudAppState,
  type CloudSyncStatus,
} from './lib/cloudMemory';
import {
  addCollaborationMember,
  createCollaborationTeam,
  loadCollaboration,
  removeCollaborationMember,
  sharePlanWithTeam,
  stopSharingPlan,
  subscribeToSharedPlans,
  updateSharedPlan,
  type CollaborationTeam,
  type SharedPlan,
  type TeamRole,
} from './lib/collaboration';

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

interface AppProps {
  accountEmail: string;
  onSignOut: () => Promise<void>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PULL_REFRESH_THRESHOLD = 64;
const PULL_REFRESH_MAX_DISTANCE = 92;

function App({ accountEmail, onSignOut }: AppProps) {
  // Theme & Language Settings
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getLocalStorage<'light' | 'dark'>('gantt_theme', 'light'));
  const [lang, setLang] = useState<Language>(() => getLocalStorage<Language>('gantt_lang', 'uk'));
  
  // Layout views & search filters
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => window.innerWidth <= 900 ? 'plans' : 'gantt');
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [isMobilePlanSheetOpen, setIsMobilePlanSheetOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);


  // Custom Templates/Projects list
  const [customTemplates, setCustomTemplates] = useState<MarketingTemplate[]>(() => 
    getLocalStorage<MarketingTemplate[]>('gantt_custom_templates', [])
  );
  const [hiddenDefaultTemplateIds, setHiddenDefaultTemplateIds] = useState<string[]>(() =>
    getLocalStorage<string[]>('gantt_hidden_default_templates', [])
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() =>
    getLocalStorage<TeamMember[]>('gantt_team_members', TEAM_MEMBERS)
  );
  const [currentUserId, setCurrentUserId] = useState('');
  const [collaborationTeams, setCollaborationTeams] = useState<CollaborationTeam[]>([]);
  const [sharedPlans, setSharedPlans] = useState<SharedPlan[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberAccess, setNewMemberAccess] = useState<Exclude<TeamRole, 'owner'>>('editor');
  const [isCollaborationBusy, setIsCollaborationBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [planNameOverrides, setPlanNameOverrides] = useState<Record<string, string>>(() =>
    getLocalStorage<Record<string, string>>('gantt_plan_name_overrides', {})
  );
  const [archivedPlanIds, setArchivedPlanIds] = useState<string[]>(() =>
    getLocalStorage<string[]>('gantt_archived_plan_ids', [])
  );
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    getLocalStorage<Reminder[]>('gantt_reminders', [])
  );
  const [ideas, setIdeas] = useState<Idea[]>(() =>
    getLocalStorage<Idea[]>('gantt_ideas', [])
  );
  
  // Active Project Plan id
  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => 
    getLocalStorage<string>('gantt_active_template_id', 'campaign-plan')
  );
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksTemplateId, setTasksTemplateId] = useState(activeTemplateId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingTodayTask, setPendingTodayTask] = useState<{ planId: string; taskId: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('connecting');
  const cloudUserIdRef = useRef<string | null>(null);
  const cloudHydratedRef = useRef(false);
  const cloudSaveTimerRef = useRef<number | null>(null);
  const cloudStatusRef = useRef<CloudSyncStatus>('connecting');
  const previousActiveTemplateIdRef = useRef(activeTemplateId);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const localTasksDirtyRef = useRef(false);
  const localTasksRevisionRef = useRef(0);
  const sharedSaveInFlightRevisionRef = useRef<number | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const pullDistanceRef = useRef(0);
  
  // Dialog confirmation states
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isReminderCenterOpen, setIsReminderCenterOpen] = useState(false);
  const [isIdeasOpen, setIsIdeasOpen] = useState(false);
  const [activeReminderId, setActiveReminderId] = useState<string | null>(null);
  const [reminderDraftTarget, setReminderDraftTarget] = useState<ReminderTargetDraft>({
    targetType: 'plan',
    planId: activeTemplateId,
  });
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>('loading');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    cloudStatusRef.current = cloudStatus;
  }, [cloudStatus]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    void getPushNotificationStatus()
      .then(async status => {
        if (status === 'enabled') await enablePushNotifications();
        if (!cancelled) setPushStatus(status);
      })
      .catch(error => {
        console.warn('Push notification status check failed', error);
        if (!cancelled) setPushStatus('disabled');
      });
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    const unlockSound = () => {
      void unlockReminderSound(false).then(isReady => {
        if (!isReady) return;
        window.removeEventListener('pointerdown', unlockSound);
        window.removeEventListener('keydown', unlockSound);
      });
    };
    window.addEventListener('pointerdown', unlockSound);
    window.addEventListener('keydown', unlockSound);
    return () => {
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, []);

  const setLocalTasks = (nextTasks: SetStateAction<Task[]>) => {
    localTasksDirtyRef.current = true;
    localTasksRevisionRef.current += 1;
    setTasks(nextTasks);
  };

  const resetPullGesture = () => {
    pullStartRef.current = null;
    if (!isPullRefreshing) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  };

  const handlePullStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobile || isPullRefreshing || contentAreaRef.current?.scrollTop !== 0) return;

    let scrollableTarget = event.target as HTMLElement | null;
    while (scrollableTarget && scrollableTarget !== contentAreaRef.current) {
      const overflowY = window.getComputedStyle(scrollableTarget).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll')
        && scrollableTarget.scrollHeight > scrollableTarget.clientHeight
        && scrollableTarget.scrollTop > 0
      ) return;
      scrollableTarget = scrollableTarget.parentElement;
    }

    const touch = event.touches[0];
    pullStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePullMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pullStartRef.current;
    if (!start || isPullRefreshing) return;

    const touch = event.touches[0];
    const deltaY = touch.clientY - start.y;
    const deltaX = Math.abs(touch.clientX - start.x);
    if (deltaY <= 0 || deltaX > deltaY) {
      resetPullGesture();
      return;
    }

    event.preventDefault();
    const nextDistance = Math.min(PULL_REFRESH_MAX_DISTANCE, deltaY * 0.48);
    pullDistanceRef.current = nextDistance;
    setPullDistance(nextDistance);
  };

  const handlePullEnd = () => {
    pullStartRef.current = null;
    if (pullDistanceRef.current < PULL_REFRESH_THRESHOLD || isPullRefreshing) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
      return;
    }

    setIsPullRefreshing(true);
    pullDistanceRef.current = PULL_REFRESH_THRESHOLD;
    setPullDistance(PULL_REFRESH_THRESHOLD);
    void (async () => {
      const startedAt = Date.now();
      while (
        (cloudStatusRef.current === 'saving' || cloudStatusRef.current === 'connecting')
        && Date.now() - startedAt < 3500
      ) {
        await new Promise(resolve => window.setTimeout(resolve, 180));
      }
      window.location.reload();
    })();
  };

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
    setLocalTasks(targetState);
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

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalledApp(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(isIos
      ? 'На iPhone натисніть «Поділитися» → «На початковий екран».'
      : 'Відкрийте меню браузера та виберіть «Встановити додаток» або «Додати на головний екран».');
  };

  // Combine Default & Custom plans
  const visibleDefaultTemplates = DEFAULT_TEMPLATES.filter(
    template => !hiddenDefaultTemplateIds.includes(template.id),
  );
  const privateTemplates = [...visibleDefaultTemplates, ...customTemplates];
  const sharedPlanViews = useMemo(() => sharedPlans
    .filter(plan => !plan.archived)
    .map(plan => {
      const viewId = plan.ownerId === currentUserId ? plan.sourcePlanId : `shared_${plan.id}`;
      return {
        plan,
        template: {
          ...plan.template,
          id: viewId,
          titleUa: plan.title,
          titleEn: plan.title,
          tasks: plan.tasks,
        } satisfies MarketingTemplate,
      };
    }), [currentUserId, sharedPlans]);
  const collaborationTemplates = sharedPlanViews
    .filter(({ template }) => !privateTemplates.some(item => item.id === template.id))
    .map(({ template }) => template);
  const availableTemplates = [...privateTemplates, ...collaborationTemplates];
  const allTemplates = availableTemplates.filter(template => !archivedPlanIds.includes(template.id));
  const archivedTemplates = availableTemplates.filter(template => archivedPlanIds.includes(template.id));
  const activeTemplate = allTemplates.find(t => t.id === activeTemplateId) || allTemplates[0] || DEFAULT_TEMPLATES[0];
  const activeSharedPlan = sharedPlanViews.find(({ template }) => template.id === activeTemplate.id)?.plan ?? null;
  const activeSharedTeam = activeSharedPlan ? collaborationTeams.find(team => team.id === activeSharedPlan.teamId) ?? null : null;
  const canEditActivePlan = !activeSharedPlan || activeSharedTeam?.currentUserRole !== 'viewer';
  const selectedCollaborationTeam = collaborationTeams.find(team => team.id === selectedTeamId) ?? collaborationTeams[0] ?? null;
  const getPlanTitle = useCallback((template: MarketingTemplate) =>
    sharedPlanViews.find(view => view.template.id === template.id)?.plan.title
    || planNameOverrides[template.id]
    || (lang === 'uk' ? template.titleUa : template.titleEn), [lang, planNameOverrides, sharedPlanViews]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  // Load tasks when activeTemplateId changes
  useEffect(() => {
    const planChanged = previousActiveTemplateIdRef.current !== activeTemplateId;
    if (!planChanged && (
      selectedTaskIdRef.current
      || localTasksDirtyRef.current
      || sharedSaveInFlightRevisionRef.current !== null
    )) return;
    const savedTasks = localStorage.getItem(`gantt_tasks_${activeTemplateId}`);
    let nextTasks = activeSharedPlan?.tasks ?? activeTemplate.tasks;
    if (savedTasks && !activeSharedPlan) {
      try {
        nextTasks = JSON.parse(savedTasks);
      } catch {
        nextTasks = activeTemplate.tasks;
      }
    }
    setTasks(nextTasks);
    setTasksTemplateId(activeTemplateId);
    localStorage.setItem('gantt_active_template_id', JSON.stringify(activeTemplateId));
    if (planChanged) {
      localTasksDirtyRef.current = false;
      setSelectedTaskId(null);
      setHistory([]); // Reset undo history stack only on an actual project swap.
    }
    previousActiveTemplateIdRef.current = activeTemplateId;
  }, [activeTemplateId, activeTemplate.tasks, activeSharedPlan]);

  useEffect(() => {
    if (!pendingTodayTask || pendingTodayTask.planId !== activeTemplateId || tasksTemplateId !== activeTemplateId) return;
    if (tasks.some(task => task.id === pendingTodayTask.taskId && !task.archived)) {
      setSelectedTaskId(pendingTodayTask.taskId);
    }
    setPendingTodayTask(null);
  }, [activeTemplateId, pendingTodayTask, tasks, tasksTemplateId]);

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

  useEffect(() => {
    localStorage.setItem('gantt_team_members', JSON.stringify(teamMembers));
  }, [teamMembers]);

  useEffect(() => {
    localStorage.setItem('gantt_plan_name_overrides', JSON.stringify(planNameOverrides));
  }, [planNameOverrides]);

  useEffect(() => {
    localStorage.setItem('gantt_archived_plan_ids', JSON.stringify(archivedPlanIds));
  }, [archivedPlanIds]);

  useEffect(() => {
    localStorage.setItem('gantt_reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem('gantt_ideas', JSON.stringify(ideas));
  }, [ideas]);

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
        let cloudState = await loadCloudState(userId);
        if (cancelled) return;

        cloudUserIdRef.current = userId;
        setCurrentUserId(userId);

        if (!cloudState) {
          cloudState = {
            version: 1,
            theme: 'light',
            lang: 'uk',
            showOnboarding: true,
            customTemplates: [],
            hiddenDefaultTemplateIds: [],
            teamMembers: TEAM_MEMBERS,
            planNameOverrides: {},
            archivedPlanIds: [],
            activeTemplateId: 'campaign-plan',
            tasksByTemplate: Object.fromEntries(
              DEFAULT_TEMPLATES.map(template => [template.id, template.tasks]),
            ),
            reminders: [],
            ideas: [],
          };
          await saveCloudState(userId, cloudState);
          if (cancelled) return;
        }

        if (cloudState) {
          Object.entries(cloudState.tasksByTemplate).forEach(([templateId, templateTasks]) => {
            localStorage.setItem(`gantt_tasks_${templateId}`, JSON.stringify(templateTasks));
          });
          localStorage.setItem('gantt_theme', JSON.stringify(cloudState.theme));
          localStorage.setItem('gantt_lang', JSON.stringify(cloudState.lang));
          localStorage.setItem('gantt_show_onboarding', JSON.stringify(cloudState.showOnboarding));
          localStorage.setItem('gantt_custom_templates', JSON.stringify(cloudState.customTemplates));
          const restoredHiddenDefaultTemplateIds = cloudState.hiddenDefaultTemplateIds ?? [];
          const restoredTeamMembers = cloudState.teamMembers ?? TEAM_MEMBERS;
          const restoredPlanNameOverrides = cloudState.planNameOverrides ?? {};
          const restoredArchivedPlanIds = cloudState.archivedPlanIds ?? [];
          const restoredReminders = cloudState.reminders ?? [];
          const restoredIdeas = cloudState.ideas ?? [];
          localStorage.setItem('gantt_hidden_default_templates', JSON.stringify(restoredHiddenDefaultTemplateIds));
          localStorage.setItem('gantt_team_members', JSON.stringify(restoredTeamMembers));
          localStorage.setItem('gantt_plan_name_overrides', JSON.stringify(restoredPlanNameOverrides));
          localStorage.setItem('gantt_archived_plan_ids', JSON.stringify(restoredArchivedPlanIds));
          localStorage.setItem('gantt_reminders', JSON.stringify(restoredReminders));
          localStorage.setItem('gantt_ideas', JSON.stringify(restoredIdeas));
          localStorage.setItem('gantt_active_template_id', JSON.stringify(cloudState.activeTemplateId));

          const restoredTemplates = [
            ...DEFAULT_TEMPLATES.filter(template => !restoredHiddenDefaultTemplateIds.includes(template.id)),
            ...cloudState.customTemplates,
          ].filter(template => !restoredArchivedPlanIds.includes(template.id));
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
          setTeamMembers(restoredTeamMembers);
          setPlanNameOverrides(restoredPlanNameOverrides);
          setArchivedPlanIds(restoredArchivedPlanIds);
          setReminders(restoredReminders);
          setIdeas(restoredIdeas);
          setActiveTemplateId(restoredTemplateId);
          setTasks(restoredTasks);
          setTasksTemplateId(restoredTemplateId);
        }

        cloudHydratedRef.current = true;
        const collaboration = await loadCollaboration();
        if (cancelled) return;
        setCollaborationTeams(collaboration.teams);
        setSharedPlans(collaboration.sharedPlans);
        setSelectedTeamId(previous => previous || collaboration.teams[0]?.id || '');
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

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const refresh = () => {
      void loadCollaboration().then(collaboration => {
        if (cancelled) return;
        setCollaborationTeams(collaboration.teams);
        setSharedPlans(collaboration.sharedPlans);
        setSelectedTeamId(previous =>
          collaboration.teams.some(team => team.id === previous)
            ? previous
            : collaboration.teams[0]?.id || ''
        );
      }).catch(error => console.error('Collaboration refresh failed', error));
    };
    const channel = subscribeToSharedPlans(refresh);
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      void channel.unsubscribe();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedCollaborationTeam) return;
    setTeamMembers(previous => {
      const next = [...previous];
      selectedCollaborationTeam.members.forEach((member, index) => {
        const name = member.displayName || member.email.split('@')[0];
        if (!next.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
          const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];
          next.push({
            name,
            roleUa: member.role === 'viewer' ? 'Перегляд' : member.role === 'owner' ? 'Власник' : 'Редактор',
            roleEn: member.role,
            avatarColor: colors[(previous.length + index) % colors.length],
          });
        }
      });
      return next.length === previous.length ? previous : next;
    });
  }, [selectedCollaborationTeam]);

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
        teamMembers,
        planNameOverrides,
        archivedPlanIds,
        activeTemplateId,
        tasksByTemplate,
        reminders,
        ideas,
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
  }, [activeTemplateId, archivedPlanIds, customTemplates, hiddenDefaultTemplateIds, ideas, lang, planNameOverrides, reminders, showOnboarding, tasks, tasksTemplateId, teamMembers, theme]);

  useEffect(() => {
    if (!activeSharedPlan || !canEditActivePlan || tasksTemplateId !== activeTemplateId || !cloudHydratedRef.current || !localTasksDirtyRef.current) return;
    const revision = localTasksRevisionRef.current;
    const timer = window.setTimeout(() => {
      // Realtime can arrive before the PATCH promise resolves. Mark this revision
      // as persisted before sending so its own echo cannot schedule another write.
      localTasksDirtyRef.current = false;
      sharedSaveInFlightRevisionRef.current = revision;
      void updateSharedPlan(activeSharedPlan.id, getPlanTitle(activeTemplate), activeTemplate, tasks)
        .then(savedTasks => {
          if (sharedSaveInFlightRevisionRef.current === revision) {
            sharedSaveInFlightRevisionRef.current = null;
          }
          if (localTasksRevisionRef.current === revision) {
            setTasks(savedTasks);
          }
          setCloudStatus('synced');
        })
        .catch(error => {
          console.error('Shared plan save failed', error);
          if (sharedSaveInFlightRevisionRef.current === revision) {
            sharedSaveInFlightRevisionRef.current = null;
          }
          if (localTasksRevisionRef.current === revision) {
            localTasksDirtyRef.current = true;
          }
          setCloudStatus('error');
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeSharedPlan, activeTemplate, activeTemplateId, canEditActivePlan, getPlanTitle, tasks, tasksTemplateId]);

  // Toast notifier helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const createClientId = (prefix: string) =>
    `${prefix}_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

  const openReminderCenter = (target: ReminderTargetDraft) => {
    setReminderDraftTarget(target);
    setIsReminderCenterOpen(true);
  };

  const handleCreateReminder = (draft: Omit<Reminder, 'id' | 'createdAt'>) => {
    const reminder: Reminder = {
      ...draft,
      id: createClientId('reminder'),
      createdAt: new Date().toISOString(),
    };
    setReminders(previous => [...previous, reminder]);
    showToast(lang === 'uk' ? 'Нагадування додано' : 'Reminder added');
  };

  const handleEnablePush = async () => {
    setPushStatus('loading');
    try {
      await enablePushNotifications();
      await syncPushReminders(reminders);
      setPushStatus('enabled');
      showToast(lang === 'uk' ? 'Push-нагадування на телефон увімкнено' : 'Phone push reminders enabled');
    } catch (error) {
      console.error('Push notification setup failed', error);
      const status = await getPushNotificationStatus().catch(() => 'disabled' as const);
      setPushStatus(status);
      showToast(
        lang === 'uk' ? 'Не вдалося ввімкнути push. Перевірте дозвіл сповіщень.' : 'Could not enable push. Check notification permission.',
        'error',
      );
    }
  };

  const handleDisablePush = async () => {
    setPushStatus('loading');
    try {
      await disablePushNotifications();
      setPushStatus('disabled');
      showToast(lang === 'uk' ? 'Push-нагадування вимкнено' : 'Phone push reminders disabled');
    } catch (error) {
      console.error('Push notification disable failed', error);
      setPushStatus('enabled');
      showToast(lang === 'uk' ? 'Не вдалося вимкнути push' : 'Could not disable push', 'error');
    }
  };

  const handleDeleteReminder = (reminderId: string) => {
    setReminders(previous => previous.filter(reminder => reminder.id !== reminderId));
    setActiveReminderId(previous => previous === reminderId ? null : previous);
  };

  const handleCompleteReminder = (reminderId: string) => {
    const now = new Date().toISOString();
    const completedReminder = reminders.find(reminder => reminder.id === reminderId);
    const recurringIdea = completedReminder?.targetType === 'idea'
      ? ideas.find(idea => idea.id === completedReminder.ideaId)
      : undefined;
    const repeatDays = recurringIdea?.reviewIntervalDays;
    let nextReviewAt: string | undefined;
    if (completedReminder && repeatDays) {
      const nextDate = new Date(completedReminder.remindAt);
      do {
        nextDate.setDate(nextDate.getDate() + repeatDays);
      } while (nextDate.getTime() <= Date.now());
      nextReviewAt = nextDate.toISOString();
    }
    setReminders(previous => previous.map(reminder =>
      reminder.id === reminderId
        ? nextReviewAt
          ? { ...reminder, remindAt: nextReviewAt, notifiedAt: now, dismissedAt: undefined }
          : { ...reminder, notifiedAt: now, dismissedAt: now }
        : reminder
    ));
    if (recurringIdea && nextReviewAt) {
      setIdeas(previous => previous.map(idea =>
        idea.id === recurringIdea.id ? { ...idea, reviewAt: nextReviewAt, updatedAt: now } : idea
      ));
    }
    setActiveReminderId(null);
  };

  const handleSnoozeReminder = (reminderId: string, minutes: number) => {
    const nextTime = new Date(Date.now() + minutes * 60_000).toISOString();
    setReminders(previous => previous.map(reminder =>
      reminder.id === reminderId
        ? { ...reminder, remindAt: nextTime, notifiedAt: new Date().toISOString(), dismissedAt: undefined }
        : reminder
    ));
    setActiveReminderId(null);
    showToast(lang === 'uk' ? `Відкладено на ${minutes} хв` : `Snoozed for ${minutes} min`);
  };

  const handleCreateIdea = (draft: Pick<Idea, 'title' | 'description' | 'planId' | 'reviewAt' | 'reviewIntervalDays'>) => {
    const now = new Date().toISOString();
    const idea: Idea = {
      ...draft,
      id: createClientId('idea'),
      status: draft.planId ? 'considering' : 'inbox',
      createdAt: now,
      updatedAt: now,
    };
    setIdeas(previous => [idea, ...previous]);
    const reviewAt = idea.reviewAt;
    if (reviewAt) {
      setReminders(previous => [...previous, {
        id: createClientId('reminder'),
        targetType: 'idea',
        ideaId: idea.id,
        title: idea.title,
        note: lang === 'uk' ? 'Повернутися до цієї ідеї та вирішити, чи перетворювати її на план.' : 'Review this idea and decide whether to turn it into a plan.',
        remindAt: reviewAt,
        createdAt: now,
      }]);
    }
    showToast(lang === 'uk' ? 'Ідею збережено' : 'Idea saved');
  };

  const handleArchiveIdea = (ideaId: string) => {
    setIdeas(previous => previous.map(idea =>
      idea.id === ideaId ? { ...idea, status: 'archived', updatedAt: new Date().toISOString() } : idea
    ));
    setReminders(previous => previous.map(reminder =>
      reminder.ideaId === ideaId ? { ...reminder, dismissedAt: new Date().toISOString() } : reminder
    ));
  };

  const handleDeleteIdea = (ideaId: string) => {
    if (!confirm(lang === 'uk' ? 'Видалити цю ідею?' : 'Delete this idea?')) return;
    setIdeas(previous => previous.filter(idea => idea.id !== ideaId));
    setReminders(previous => previous.filter(reminder => reminder.ideaId !== ideaId));
  };

  const handleConvertIdeaToPlan = (ideaId: string) => {
    const idea = ideas.find(item => item.id === ideaId);
    if (!idea) return;
    const planId = createClientId('custom_idea');
    const plan: MarketingTemplate = {
      id: planId,
      titleUa: idea.title,
      titleEn: idea.title,
      categoryUa: 'План з ідеї',
      categoryEn: 'Plan from idea',
      descriptionUa: idea.description || 'План створено зі сховища ідей.',
      descriptionEn: idea.description || 'Plan created from the idea inbox.',
      iconName: 'Lightbulb',
      tasks: [],
    };
    setCustomTemplates(previous => [...previous, plan]);
    setIdeas(previous => previous.map(item =>
      item.id === ideaId
        ? { ...item, status: 'converted', convertedPlanId: planId, updatedAt: new Date().toISOString() }
        : item
    ));
    setReminders(previous => previous.map(reminder =>
      reminder.ideaId === ideaId ? { ...reminder, dismissedAt: new Date().toISOString() } : reminder
    ));
    setActiveTemplateId(planId);
    setActiveTab('grid');
    setIsIdeasOpen(false);
    showToast(lang === 'uk' ? 'Ідею перетворено на план' : 'Idea converted to a plan');
  };

  const handleTemplateSelect = (id: string) => {
    setActiveTemplateId(id);
  };

  const handleOpenTodayPlan = (planId: string) => {
    setActiveTemplateId(planId);
    setActiveTab('gantt');
  };

  const handleOpenTodayTask = (planId: string, taskId: string) => {
    setActiveTab('gantt');
    if (planId === activeTemplateId && tasksTemplateId === activeTemplateId) {
      setSelectedTaskId(taskId);
      return;
    }
    setPendingTodayTask({ planId, taskId });
    setActiveTemplateId(planId);
  };

  const handleArchivePlan = (templateId: string) => {
    const template = allTemplates.find(item => item.id === templateId);
    if (!template) return;
    if (allTemplates.length <= 1) {
      showToast(lang === 'uk' ? 'Не можна архівувати останній активний план' : 'You cannot archive the last active plan', 'error');
      return;
    }

    setArchivedPlanIds(previous => previous.includes(templateId) ? previous : [...previous, templateId]);
    if (activeTemplateId === templateId) {
      const nextTemplate = allTemplates.find(item => item.id !== templateId);
      if (nextTemplate) setActiveTemplateId(nextTemplate.id);
    }
    showToast(lang === 'uk' ? `План «${getPlanTitle(template)}» переміщено в архів` : `“${getPlanTitle(template)}” moved to archive`);
  };

  const handleRestorePlan = (templateId: string) => {
    const template = archivedTemplates.find(item => item.id === templateId);
    setArchivedPlanIds(previous => previous.filter(id => id !== templateId));
    if (template) showToast(lang === 'uk' ? `План «${getPlanTitle(template)}» відновлено` : `“${getPlanTitle(template)}” restored`);
  };

  const handleArchiveTask = (taskId: string) => {
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    saveToHistory(lang === 'uk' ? 'Завдання архівовано' : 'Archived task', 'Archived task');
    setLocalTasks(previous => previous.map(item => item.id === taskId ? { ...item, archived: true } : item));
    setSelectedTaskId(null);
    showToast(lang === 'uk' ? `Завдання «${task.title}» переміщено в архів` : `“${task.title}” moved to archive`);
  };

  const handleRestoreTask = (taskId: string) => {
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
    setLocalTasks(previous => previous.map(item => item.id === taskId ? { ...item, archived: false } : item));
    showToast(lang === 'uk' ? 'Завдання відновлено' : 'Task restored');
  };

  const handleRenamePlan = async (templateId: string) => {
    const template = allTemplates.find(item => item.id === templateId);
    if (!template) return;
    const sharedView = sharedPlanViews.find(view => view.template.id === templateId);
    if (sharedView) {
      const team = collaborationTeams.find(item => item.id === sharedView.plan.teamId);
      if (team?.currentUserRole === 'viewer') {
        showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
        return;
      }
    }

    const newName = prompt(
      lang === 'uk' ? 'Введіть нову назву плану:' : 'Enter a new plan name:',
      getPlanTitle(template),
    )?.trim();
    if (!newName || newName === getPlanTitle(template)) return;

    if (sharedView) {
      try {
        await updateSharedPlan(
          sharedView.plan.id,
          newName,
          { ...sharedView.plan.template, titleUa: newName, titleEn: newName },
          templateId === activeTemplateId ? tasks : sharedView.plan.tasks,
        );
        await refreshCollaborationState();
      } catch (error) {
        console.error('Shared plan rename failed', error);
        showToast(lang === 'uk' ? 'Не вдалося перейменувати командний план' : 'Could not rename the team plan', 'error');
        return;
      }
    } else {
      setPlanNameOverrides(prev => ({ ...prev, [templateId]: newName }));
    }
    showToast(lang === 'uk' ? 'Назву плану оновлено' : 'Plan name updated');
  };

  const refreshCollaborationState = async () => {
    const collaboration = await loadCollaboration();
    setCollaborationTeams(collaboration.teams);
    setSharedPlans(collaboration.sharedPlans);
    setSelectedTeamId(previous =>
      collaboration.teams.some(team => team.id === previous)
        ? previous
        : collaboration.teams[0]?.id || ''
    );
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (name.length < 2) {
      showToast(lang === 'uk' ? 'Введіть назву команди' : 'Enter a team name', 'error');
      return;
    }
    setIsCollaborationBusy(true);
    try {
      const teamId = await createCollaborationTeam(name);
      setNewTeamName('');
      await refreshCollaborationState();
      setSelectedTeamId(teamId);
      showToast(lang === 'uk' ? 'Команду створено' : 'Team created');
    } catch (error) {
      console.error('Team creation failed', error);
      showToast(lang === 'uk' ? 'Не вдалося створити команду' : 'Could not create team', 'error');
    } finally {
      setIsCollaborationBusy(false);
    }
  };

  const handleAddCollaborationMember = async () => {
    if (!selectedCollaborationTeam || !newMemberEmail.trim()) return;
    setIsCollaborationBusy(true);
    try {
      await addCollaborationMember(selectedCollaborationTeam.id, newMemberEmail, newMemberAccess);
      setNewMemberEmail('');
      await refreshCollaborationState();
      showToast(lang === 'uk' ? 'Учасника додано до команди' : 'Member added to the team');
    } catch (error) {
      console.error('Team member creation failed', error);
      const message = error instanceof Error && error.message.includes('create and confirm')
        ? (lang === 'uk' ? 'Спочатку користувач має створити й підтвердити свій акаунт' : 'The user must create and confirm an account first')
        : (lang === 'uk' ? 'Не вдалося додати учасника' : 'Could not add member');
      showToast(message, 'error');
    } finally {
      setIsCollaborationBusy(false);
    }
  };

  const handleRemoveCollaborationMember = async (memberUserId: string) => {
    if (!selectedCollaborationTeam || !confirm(lang === 'uk' ? 'Видалити учасника з команди?' : 'Remove this team member?')) return;
    setIsCollaborationBusy(true);
    try {
      await removeCollaborationMember(selectedCollaborationTeam.id, memberUserId);
      await refreshCollaborationState();
      showToast(lang === 'uk' ? 'Учасника видалено' : 'Member removed');
    } catch (error) {
      console.error('Team member removal failed', error);
      showToast(lang === 'uk' ? 'Не вдалося видалити учасника' : 'Could not remove member', 'error');
    } finally {
      setIsCollaborationBusy(false);
    }
  };

  const handleTogglePlanSharing = async () => {
    if (activeSharedPlan) {
      const team = collaborationTeams.find(item => item.id === activeSharedPlan.teamId);
      const canStopSharing = activeSharedPlan.ownerId === currentUserId || team?.currentUserRole === 'owner';
      if (!canStopSharing) {
        showToast(lang === 'uk' ? 'Лише власник плану або команди може зробити його приватним' : 'Only the plan or team owner can make it private', 'error');
        return;
      }
      if (!confirm(lang === 'uk' ? 'Зробити цей план приватним? Команда втратить доступ.' : 'Make this plan private? The team will lose access.')) return;
      setIsCollaborationBusy(true);
      try {
        await stopSharingPlan(activeSharedPlan.id);
        await refreshCollaborationState();
        showToast(lang === 'uk' ? 'План знову приватний' : 'The plan is private again');
      } catch (error) {
        console.error('Stop sharing failed', error);
        showToast(lang === 'uk' ? 'Не вдалося змінити доступ' : 'Could not change access', 'error');
      } finally {
        setIsCollaborationBusy(false);
      }
      return;
    }

    if (!selectedCollaborationTeam) {
      setIsTeamManagerOpen(true);
      showToast(lang === 'uk' ? 'Спочатку створіть команду' : 'Create a team first', 'error');
      return;
    }

    setIsCollaborationBusy(true);
    try {
      await sharePlanWithTeam({
        teamId: selectedCollaborationTeam.id,
        ownerId: currentUserId,
        sourcePlanId: activeTemplate.id,
        title: getPlanTitle(activeTemplate),
        template: activeTemplate,
        tasks,
      });
      await refreshCollaborationState();
      showToast(lang === 'uk' ? `План відкрито для команди «${selectedCollaborationTeam.name}»` : `Plan shared with “${selectedCollaborationTeam.name}”`);
    } catch (error) {
      console.error('Plan sharing failed', error);
      showToast(lang === 'uk' ? 'Не вдалося поділитися планом' : 'Could not share the plan', 'error');
    } finally {
      setIsCollaborationBusy(false);
    }
  };

  // Add Task
  const handleAddTask = (status: Task['status'] = 'todo') => {
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
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
      assignee: teamMembers[0]?.name ?? '',
      isMilestone: false,
      color: '#6366f1',
      subtasks: [],
      comments: []
    };
    
    setLocalTasks(prev => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
  };

  // Clone/Duplicate Task
  const handleCloneTask = (taskId: string) => {
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
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
    
    setLocalTasks(newTasksList);
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
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
    setLocalTasks(prev => {
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
    if (!canEditActivePlan) return showToast(lang === 'uk' ? 'У вас доступ лише для перегляду' : 'You have view-only access', 'error');
    saveToHistory(
      lang === 'uk' ? 'Видалено завдання' : 'Deleted task',
      'Deleted task'
    );

    setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    setReminders(previous => previous.filter(reminder =>
      !(reminder.planId === activeTemplateId && reminder.taskId === taskId)
    ));
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

    const availableAssignees = new Set(teamMembers.map(member => member.name));
    setLocalTasks(activeTemplate.tasks.map(task => ({
      ...task,
      assignee: availableAssignees.has(task.assignee) ? task.assignee : '',
      subtasks: task.subtasks.map(subtask => ({
        ...subtask,
        assignee: subtask.assignee && availableAssignees.has(subtask.assignee)
          ? subtask.assignee
          : undefined,
      })),
    })));
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
          assignee: teamMembers[0]?.name ?? '',
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
    const activeTitle = getPlanTitle(activeTemplate);
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

    const templateTitle = getPlanTitle(template);
    const confirmDel = confirm(`${getTranslation(lang, 'confirmDeletePlan')}\n\n${templateTitle}`);
    if (!confirmDel) return;

    if (defaultTemplate) {
      setHiddenDefaultTemplateIds(prev => prev.includes(templateId) ? prev : [...prev, templateId]);
    } else {
      setCustomTemplates(prev => prev.filter(t => t.id !== templateId));
    }
    setPlanNameOverrides(prev => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
    localStorage.removeItem(`gantt_tasks_${templateId}`);
    setReminders(previous => previous.filter(reminder => reminder.planId !== templateId));

    if (activeTemplateId === templateId) {
      const nextTemplate = allTemplates.find(t => t.id !== templateId);
      if (nextTemplate) setActiveTemplateId(nextTemplate.id);
    }
    showToast(lang === 'uk' ? 'Шаблон видалено' : 'Template deleted', 'success');
  };

  // Save current plan state as a custom template
  const handleSaveAsTemplate = () => {
    const titlePrompt = prompt(
      lang === 'uk' 
        ? 'Введіть назву для вашого шаблону:' 
        : 'Enter a name for your custom template:',
      `${getPlanTitle(activeTemplate)} - ${lang === 'uk' ? 'Копія' : 'Copy'}`
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
            setLocalTasks(importedTasks);
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
  const activeTasks = tasks.filter(task => !task.archived);
  const archivedTasks = tasks.filter(task => task.archived);
  const filteredTasks = activeTasks.filter(t => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch = t.title.toLowerCase().includes(normalizedQuery) ||
                          t.assignee.toLowerCase().includes(normalizedQuery) ||
                          t.subtasks.some(subtask =>
                            subtask.title.toLowerCase().includes(normalizedQuery) ||
                            (subtask.assignee ?? '').toLowerCase().includes(normalizedQuery)
                          );
    const matchesAssignee = filterAssignee === 'all'
      || (filterAssignee === '__unassigned__'
        ? !t.assignee || t.subtasks.some(subtask => !subtask.assignee)
        : t.assignee === filterAssignee || t.subtasks.some(subtask => subtask.assignee === filterAssignee));
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesAssignee && matchesStatus;
  });

  const completedTasks = activeTasks.filter(t => t.status === 'done').length;
  const averageProgress = activeTasks.length
    ? Math.round(activeTasks.reduce((sum, task) => sum + (task.isMilestone ? 0 : task.progress), 0) / activeTasks.length)
    : 0;
  const planCalendarItems: PlanCalendarItem[] = allTemplates.map(template => {
    const templateTasks = template.id === activeTemplateId
      ? tasks
      : getLocalStorage<Task[] | null>(`gantt_tasks_${template.id}`, null) ?? template.tasks;
    const activeTemplateTasks = templateTasks.filter(task => !task.archived);
    const datedTasks = activeTemplateTasks.filter(task => task.startDate && task.endDate);
    const today = new Date().toISOString().split('T')[0];
    const startDate = datedTasks.length
      ? datedTasks.reduce((earliest, task) => task.startDate < earliest ? task.startDate : earliest, datedTasks[0].startDate)
      : today;
    const endDate = datedTasks.length
      ? datedTasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, datedTasks[0].endDate)
      : today;
    const progressTasks = activeTemplateTasks.filter(task => !task.isMilestone);

    return {
      id: template.id,
      title: getPlanTitle(template),
      category: lang === 'uk' ? template.categoryUa : template.categoryEn,
      startDate,
      endDate,
      progress: progressTasks.length
        ? Math.round(progressTasks.reduce((sum, task) => sum + task.progress, 0) / progressTasks.length)
        : 0,
      taskCount: activeTemplateTasks.length,
      color: activeTemplateTasks.find(task => task.color)?.color ?? '#6366f1',
    };
  });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayPlanGroups: TodayPlanGroup[] = allTemplates.flatMap(template => {
    const templateTasks = template.id === activeTemplateId
      ? tasks
      : getLocalStorage<Task[] | null>(`gantt_tasks_${template.id}`, null) ?? template.tasks;
    const availableTasks = templateTasks.filter(task => !task.archived);
    const items = availableTasks.flatMap(task => {
      const taskItems = task.startDate <= today && task.endDate >= today
        ? [{
            id: task.id,
            parentTaskId: task.id,
            title: task.title,
            assignee: task.assignee,
            status: task.status,
            isSubtask: false,
            startDate: task.startDate,
            endDate: task.endDate,
          }]
        : [];
      const subtaskItems = task.subtasks
        .filter(subtask => {
          const startDate = subtask.startDate ?? task.startDate;
          const endDate = subtask.endDate ?? task.endDate;
          return startDate <= today && endDate >= today;
        })
        .map(subtask => ({
          id: subtask.id,
          parentTaskId: task.id,
          title: subtask.title,
          assignee: subtask.assignee ?? task.assignee,
          status: subtask.status ?? (subtask.completed ? 'done' as const : 'todo' as const),
          isSubtask: true,
          startDate: subtask.startDate ?? task.startDate,
          endDate: subtask.endDate ?? task.endDate,
        }));
      return [...taskItems, ...subtaskItems];
    });

    if (items.length === 0) return [];
    return [{
      id: template.id,
      title: getPlanTitle(template),
      color: availableTasks.find(task => task.color)?.color ?? '#6366f1',
      items,
    }];
  });
  const activeTemplateTitle = getPlanTitle(activeTemplate);
  const activeTemplateDescription = lang === 'uk' ? activeTemplate.descriptionUa : activeTemplate.descriptionEn;
  const reminderPlans: ReminderPlanOption[] = allTemplates.map(template => {
    const planTasks = template.id === activeTemplateId
      ? tasks
      : getLocalStorage<Task[] | null>(`gantt_tasks_${template.id}`, null) ?? template.tasks;
    return {
      id: template.id,
      title: getPlanTitle(template),
      tasks: planTasks.filter(task => !task.archived).map(task => ({
        id: task.id,
        title: task.title,
        subtasks: task.subtasks.map(subtask => ({ id: subtask.id, title: subtask.title })),
      })),
    };
  });
  const getReminderTargetLabel = (reminder: Reminder) => {
    if (reminder.targetType === 'idea') {
      return ideas.find(idea => idea.id === reminder.ideaId)?.title
        ?? (lang === 'uk' ? 'Ідея' : 'Idea');
    }
    const plan = reminderPlans.find(item => item.id === reminder.planId);
    const task = plan?.tasks.find(item => item.id === reminder.taskId);
    const subtask = task?.subtasks.find(item => item.id === reminder.subtaskId);
    if (reminder.targetType === 'subtask') return `${plan?.title ?? ''} · ${task?.title ?? ''} · ${subtask?.title ?? reminder.title}`;
    if (reminder.targetType === 'task') return `${plan?.title ?? ''} · ${task?.title ?? reminder.title}`;
    return plan?.title ?? reminder.title;
  };
  const activeReminder = reminders.find(reminder => reminder.id === activeReminderId) ?? null;
  const activeFiltersCount = [
    searchQuery.trim() ? 'search' : null,
    filterAssignee !== 'all' ? 'assignee' : null,
    filterStatus !== 'all' ? 'status' : null
  ].filter(Boolean).length;

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  useEffect(() => {
    if (!currentUserId || pushStatus !== 'enabled' || !cloudHydratedRef.current) return;
    if (pushSyncTimerRef.current !== null) window.clearTimeout(pushSyncTimerRef.current);
    pushSyncTimerRef.current = window.setTimeout(() => {
      void syncPushReminders(reminders).catch(error => {
        console.error('Push reminder sync failed', error);
      });
    }, 700);
    return () => {
      if (pushSyncTimerRef.current !== null) window.clearTimeout(pushSyncTimerRef.current);
    };
  }, [currentUserId, pushStatus, reminders]);

  useEffect(() => {
    const checkDueReminders = () => {
      if (activeReminderId) return;
      const dueReminder = reminders
        .filter(reminder => !reminder.dismissedAt && Date.parse(reminder.remindAt) <= Date.now())
        .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt))[0];
      if (!dueReminder) return;
      setActiveReminderId(dueReminder.id);
      void playReminderSound();
      if ('vibrate' in navigator) navigator.vibrate([120, 70, 120]);
      if (pushStatus !== 'enabled' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`${lang === 'uk' ? 'Нагадування' : 'Reminder'}: ${dueReminder.title}`, {
            body: dueReminder.note || dueReminder.title,
            icon: '/icons/marketing-plan-192.png',
            tag: dueReminder.id,
          });
        } catch (error) {
          console.warn('Browser notification is unavailable', error);
        }
      }
    };

    checkDueReminders();
    const interval = window.setInterval(checkDueReminders, 20_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkDueReminders();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeReminderId, ideas, lang, pushStatus, reminders]);

  const renderTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Megaphone': return <Megaphone size={16} />;
      case 'Globe': return <Globe size={16} />;
      case 'Compass': return <Compass size={16} />;
      case 'BookOpen': return <BookOpen size={16} />;
      case 'Calendar': return <Calendar size={16} />;
      case 'Lightbulb': return <Lightbulb size={16} />;
      default: return <FileText size={16} />;
    }
  };

  // Handle Responsive Viewport Logic
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobilePlanSheetOpen(false);
        setIsMobileMenuOpen(false);
        setIsMobileFiltersOpen(false);
      }
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
          <img className="brand-icon brand-icon-image" src="/icons/marketing-plan-192.png" alt="" />
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
                {visibleDefaultTemplates.filter(t => !archivedPlanIds.includes(t.id)).map(t => (
                  <div className="template-row" key={t.id}>
                    <button
                      className={`template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(t.id)}
                    >
                      <div className="template-icon-wrapper">
                        {renderTemplateIcon(t.iconName)}
                      </div>
                      <div className="template-details">
                        <h4>{getPlanTitle(t)}</h4>
                        <span>{lang === 'uk' ? t.categoryUa : t.categoryEn}</span>
                      </div>
                    </button>
                    <button
                      className="template-edit-btn"
                      onClick={() => handleRenamePlan(t.id)}
                      title={lang === 'uk' ? 'Перейменувати план' : 'Rename plan'}
                      aria-label={`${lang === 'uk' ? 'Перейменувати план' : 'Rename plan'}: ${getPlanTitle(t)}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="template-archive-btn"
                      onClick={() => handleArchivePlan(t.id)}
                      title={lang === 'uk' ? 'Архівувати план' : 'Archive plan'}
                      aria-label={`${lang === 'uk' ? 'Архівувати план' : 'Archive plan'}: ${getPlanTitle(t)}`}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      className="template-delete-btn"
                      onClick={() => handleDeletePlan(t.id)}
                      title={getTranslation(lang, 'deletePlan')}
                      aria-label={`${getTranslation(lang, 'deletePlan')}: ${getPlanTitle(t)}`}
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
                {customTemplates.filter(t => !archivedPlanIds.includes(t.id)).map(t => (
                  <div className="template-row" key={t.id}>
                    <button
                      className={`template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(t.id)}
                    >
                      <div className="template-icon-wrapper">
                        {renderTemplateIcon(t.iconName)}
                      </div>
                      <div className="template-details">
                        <h4>{getPlanTitle(t)}</h4>
                        <span>{lang === 'uk' ? t.categoryUa : t.categoryEn}</span>
                      </div>
                    </button>
                    <button
                      className="template-edit-btn"
                      onClick={() => handleRenamePlan(t.id)}
                      title={lang === 'uk' ? 'Перейменувати план' : 'Rename plan'}
                      aria-label={`${lang === 'uk' ? 'Перейменувати план' : 'Rename plan'}: ${getPlanTitle(t)}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="template-archive-btn"
                      onClick={() => handleArchivePlan(t.id)}
                      title={lang === 'uk' ? 'Архівувати план' : 'Archive plan'}
                      aria-label={`${lang === 'uk' ? 'Архівувати план' : 'Archive plan'}: ${getPlanTitle(t)}`}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      className="template-delete-btn"
                      onClick={() => handleDeletePlan(t.id)}
                      title={getTranslation(lang, 'deletePlan')}
                      aria-label={`${getTranslation(lang, 'deletePlan')}: ${getPlanTitle(t)}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                
                {customTemplates.filter(t => !archivedPlanIds.includes(t.id)).length === 0 && (
                  <div className="empty-mini">
                    {lang === 'uk' ? 'Створіть свій план' : 'Create your plan'}
                  </div>
                )}
              </div>
            )}
          </div>

          {collaborationTemplates.length > 0 && (
            <div>
              <h3 className="sidebar-section-title sidebar-section-heading">
                <span className="sidebar-section-toggle">
                  <Users size={14} />
                  <span>{lang === 'uk' ? 'Командні плани' : 'Team plans'}</span>
                </span>
              </h3>
              <div className="template-list">
                {collaborationTemplates.map(template => (
                  <div className="template-row" key={template.id}>
                    <button
                      className={`template-item ${activeTemplateId === template.id ? 'active' : ''}`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <div className="template-icon-wrapper"><Users size={16} /></div>
                      <div className="template-details">
                        <h4>{getPlanTitle(template)}</h4>
                        <span>{collaborationTeams.find(team => team.id === sharedPlanViews.find(view => view.template.id === template.id)?.plan.teamId)?.name}</span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-actions">
          <div className="sidebar-actions-header">
            <span className={`plan-access-badge ${activeSharedPlan ? 'team' : 'private'}`}>
              {activeSharedPlan ? <Users size={12} /> : <Lock size={12} />}
              {activeSharedPlan
                ? (lang === 'uk' ? 'Командний' : 'Team')
                : (lang === 'uk' ? 'Приватний' : 'Private')}
            </span>
            <strong title={activeTemplateTitle}>{activeTemplateTitle}</strong>
          </div>

          <button className="sidebar-action-btn" onClick={() => void handleTogglePlanSharing()} disabled={isCollaborationBusy}>
            <span className="sidebar-action-icon">{activeSharedPlan ? <Lock size={15} /> : <Share2 size={15} />}</span>
            <span className="sidebar-action-copy">
              <strong>{activeSharedPlan
                ? (lang === 'uk' ? 'Зробити приватним' : 'Make private')
                : (lang === 'uk' ? 'Поділитися з командою' : 'Share with team')}</strong>
              <small>{activeSharedPlan
                ? (collaborationTeams.find(team => team.id === activeSharedPlan.teamId)?.name ?? '')
                : (selectedCollaborationTeam?.name ?? (lang === 'uk' ? 'Оберіть або створіть команду' : 'Choose or create a team'))}</small>
            </span>
            <ChevronRight className="sidebar-action-arrow" size={14} />
          </button>

          <button className="sidebar-action-btn" onClick={handleDuplicateActivePlan} title={getTranslation(lang, 'duplicatePlan')}>
            <span className="sidebar-action-icon"><Copy size={15} /></span>
            <span className="sidebar-action-copy">
              <strong>{lang === 'uk' ? 'Дублювати план' : 'Duplicate plan'}</strong>
              <small>{lang === 'uk' ? 'Створити незалежну копію' : 'Create an independent copy'}</small>
            </span>
            <ChevronRight className="sidebar-action-arrow" size={14} />
          </button>

          <button className="sidebar-action-btn" onClick={handleSaveAsTemplate} title={getTranslation(lang, 'addCustomTemplate')}>
            <span className="sidebar-action-icon"><Plus size={15} /></span>
            <span className="sidebar-action-copy">
              <strong>{getTranslation(lang, 'addCustomTemplate')}</strong>
              <small>{lang === 'uk' ? 'Зберегти структуру для повторного використання' : 'Save structure for reuse'}</small>
            </span>
            <ChevronRight className="sidebar-action-arrow" size={14} />
          </button>

          <button className="sidebar-action-btn sidebar-action-danger" onClick={() => setIsResetConfirmOpen(true)} title={getTranslation(lang, 'resetTemplate')}>
            <span className="sidebar-action-icon"><RotateCcw size={15} /></span>
            <span className="sidebar-action-copy">
              <strong>{getTranslation(lang, 'resetTemplate')}</strong>
              <small>{lang === 'uk' ? 'Повернути початкові дані плану' : 'Restore the plan’s original data'}</small>
            </span>
            <ChevronRight className="sidebar-action-arrow" size={14} />
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-workspace">
        <div
          className={`mobile-pull-indicator ${pullDistance >= PULL_REFRESH_THRESHOLD ? 'ready' : ''} ${isPullRefreshing ? 'refreshing' : ''}`}
          style={{
            opacity: pullDistance > 4 || isPullRefreshing ? 1 : 0,
            transform: `translate(-50%, ${Math.max(-54, pullDistance - 54)}px)`,
          }}
          role="status"
          aria-live="polite"
        >
          <RotateCcw size={16} style={{ transform: isPullRefreshing ? undefined : `rotate(${pullDistance * 3}deg)` }} />
          <span>
            {isPullRefreshing
              ? (lang === 'uk' ? 'Оновлюємо…' : 'Refreshing…')
              : pullDistance >= PULL_REFRESH_THRESHOLD
                ? (lang === 'uk' ? 'Відпустіть для оновлення' : 'Release to refresh')
                : (lang === 'uk' ? 'Потягніть для оновлення' : 'Pull to refresh')}
          </span>
        </div>
        <header className="mobile-app-header">
          <button
            className="mobile-header-button"
            onClick={() => setIsMobilePlanSheetOpen(true)}
            aria-label={lang === 'uk' ? 'Відкрити список планів' : 'Open plans list'}
          >
            <FolderOpen size={20} />
          </button>
          <button className="mobile-current-plan" onClick={() => setIsMobilePlanSheetOpen(true)}>
            <small>
              {activeTab === 'plans'
                ? (lang === 'uk' ? 'Робочий простір' : 'Workspace')
                : (lang === 'uk' ? 'Поточний план' : 'Current plan')}
            </small>
            <strong>{activeTab === 'plans' ? (lang === 'uk' ? 'Мої плани' : 'My plans') : activeTemplateTitle}</strong>
          </button>
          <span className={`mobile-cloud-status mobile-cloud-${cloudStatus}`} title={cloudStatus}>
            {cloudStatus === 'synced' && <Cloud size={16} />}
            {(cloudStatus === 'connecting' || cloudStatus === 'saving') && <LoaderCircle size={16} />}
            {cloudStatus === 'error' && <CloudOff size={16} />}
          </span>
          <button
            className="mobile-header-button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label={lang === 'uk' ? 'Більше дій' : 'More actions'}
          >
            <MoreHorizontal size={21} />
          </button>
        </header>

        {activeTab !== 'plans' && (
          <div className="mobile-search-panel">
            <div className="mobile-search-row">
              <label>
                <Search size={16} />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder={lang === 'uk' ? 'Знайти завдання…' : 'Find a task…'}
                />
              </label>
              <button
                className={isMobileFiltersOpen || activeFiltersCount > 0 ? 'active' : ''}
                onClick={() => setIsMobileFiltersOpen(previous => !previous)}
                aria-label={lang === 'uk' ? 'Фільтри' : 'Filters'}
              >
                <SlidersHorizontal size={17} />
                {activeFiltersCount > 0 && <span>{activeFiltersCount}</span>}
              </button>
            </div>
            {isMobileFiltersOpen && (
              <div className="mobile-filter-options">
                <select value={filterAssignee} onChange={event => setFilterAssignee(event.target.value)}>
                  <option value="all">{lang === 'uk' ? 'Всі виконавці' : 'All assignees'}</option>
                  <option value="__unassigned__">{lang === 'uk' ? 'Без виконавця' : 'Unassigned'}</option>
                  {teamMembers.map(member => <option value={member.name} key={member.name}>{member.name}</option>)}
                </select>
                <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)}>
                  <option value="all">{lang === 'uk' ? 'Всі статуси' : 'All statuses'}</option>
                  <option value="todo">{getTranslation(lang, 'todo')}</option>
                  <option value="in_progress">{getTranslation(lang, 'in_progress')}</option>
                  <option value="in_review">{getTranslation(lang, 'in_review')}</option>
                  <option value="done">{getTranslation(lang, 'done')}</option>
                </select>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterAssignee('all');
                    setFilterStatus('all');
                  }}
                >
                  <X size={14} />{lang === 'uk' ? 'Очистити' : 'Clear'}
                </button>
              </div>
            )}
            {activeTab === 'gantt' && (
              <div className="mobile-zoom-switch">
                {(['days', 'weeks', 'months'] as ZoomLevel[]).map(level => (
                  <button className={zoomLevel === level ? 'active' : ''} onClick={() => setZoomLevel(level)} key={level}>
                    {getTranslation(lang, level as any)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
              {(['plans', 'gantt', 'grid', 'kanban', 'workload'] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  className={`view-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'plans' && <CalendarRange size={14} />}
                  {tab === 'gantt' && <Calendar size={14} />}
                  {tab === 'grid' && <Table size={14} />}
                  {tab === 'kanban' && <Compass size={14} />}
                  {tab === 'workload' && <Users size={14} />}
                  <span className="hide-mobile-text">
                    {tab === 'plans'
                      ? (lang === 'uk' ? 'Плани' : 'Plans')
                      : getTranslation(lang, `view${tab.charAt(0).toUpperCase() + tab.slice(1)}` as any)}
                  </span>
                </button>
              ))}
            </div>

            {(activeTab === 'gantt' || activeTab === 'plans') && (
              <div className="controls-group gantt-controls">
                {activeTab === 'gantt' && (
                  <button
                    className={`btn btn-secondary btn-compact ${showGanttSidebar ? 'active' : ''}`}
                    onClick={() => setShowGanttSidebar(!showGanttSidebar)}
                    title={lang === 'uk' ? 'Показати/Сховати список завдань' : 'Toggle Gantt Tasks List'}
                  >
                    {showGanttSidebar ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{lang === 'uk' ? 'Завдання' : 'Tasks'}</span>
                  </button>
                )}

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
            {activeTab !== 'plans' && (
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
            )}

            {activeTab !== 'plans' && <div className="controls-group">
              <select
                className="header-filter-select"
                value={filterAssignee}
                onChange={e => setFilterAssignee(e.target.value)}
                title={lang === 'uk' ? 'Фільтр за виконавцем' : 'Filter by Assignee'}
              >
                <option value="all">{lang === 'uk' ? 'Всі виконавці' : 'All Assignees'}</option>
                <option value="__unassigned__">{lang === 'uk' ? 'Без виконавця' : 'Unassigned'}</option>
                {teamMembers.map(member => (
                  <option key={member.name} value={member.name}>{member.name}</option>
                ))}
              </select>

              <button
                className="btn-icon"
                onClick={() => setIsTeamManagerOpen(true)}
                title={lang === 'uk' ? 'Керувати виконавцями' : 'Manage assignees'}
                aria-label={lang === 'uk' ? 'Керувати виконавцями' : 'Manage assignees'}
              >
                <Users size={16} />
              </button>

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
            </div>}

            <div className="controls-group">
              <button
                className={`btn-icon feature-header-button ${reminders.some(reminder => !reminder.dismissedAt) ? 'has-items' : ''}`}
                onClick={() => openReminderCenter({ targetType: 'plan', planId: activeTemplateId })}
                title={lang === 'uk' ? 'Нагадування' : 'Reminders'}
                aria-label={lang === 'uk' ? 'Відкрити нагадування' : 'Open reminders'}
              >
                <Bell size={16} />
                {reminders.filter(reminder => !reminder.dismissedAt).length > 0 && <span>{reminders.filter(reminder => !reminder.dismissedAt).length}</span>}
              </button>
              <button
                className={`btn-icon feature-header-button ideas-header-button ${ideas.some(idea => idea.status !== 'archived') ? 'has-items' : ''}`}
                onClick={() => setIsIdeasOpen(true)}
                title={lang === 'uk' ? 'Сховище ідей' : 'Idea inbox'}
                aria-label={lang === 'uk' ? 'Відкрити сховище ідей' : 'Open idea inbox'}
              >
                <Lightbulb size={16} />
                {ideas.filter(idea => idea.status !== 'archived').length > 0 && <span>{ideas.filter(idea => idea.status !== 'archived').length}</span>}
              </button>
              <button
                className={`btn-icon archive-manager-button ${archivedTemplates.length + archivedTasks.length > 0 ? 'has-items' : ''}`}
                onClick={() => setIsArchiveOpen(true)}
                title={lang === 'uk' ? 'Відкрити архів' : 'Open archive'}
                aria-label={lang === 'uk' ? 'Відкрити архів' : 'Open archive'}
              >
                <Archive size={16} />
                {archivedTemplates.length + archivedTasks.length > 0 && (
                  <span>{archivedTemplates.length + archivedTasks.length}</span>
                )}
              </button>
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

              <div className="account-chip" title={accountEmail}>
                <CircleUserRound size={16} />
                <span>{accountEmail}</span>
                <button
                  onClick={() => void onSignOut()}
                  title={lang === 'uk' ? 'Вийти з кабінету' : 'Sign out'}
                  aria-label={lang === 'uk' ? 'Вийти з кабінету' : 'Sign out'}
                >
                  <LogOut size={14} />
                </button>
              </div>

              {!isInstalledApp && (
                <button
                  className="btn-icon install-app-button"
                  onClick={() => void handleInstallApp()}
                  title={lang === 'uk' ? 'Встановити як додаток' : 'Install app'}
                  aria-label={lang === 'uk' ? 'Встановити як додаток' : 'Install app'}
                >
                  <Smartphone size={16} />
                </button>
              )}

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

        {!isMobile && activeTab !== 'gantt' && activeTab !== 'plans' && (
          <section className="project-summary">
            <div className="project-title-block">
              <p className="eyebrow">{lang === 'uk' ? 'Поточний план' : 'Current plan'}</p>
              <h1>{activeTemplateTitle}</h1>
              <p>{activeTemplateDescription}</p>
            </div>

            <div className="summary-stats">
              <div className="summary-stat">
                <span>{lang === 'uk' ? 'Завдань' : 'Tasks'}</span>
                <strong>{activeTasks.length}</strong>
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

        {!isMobile && activeTab !== 'plans' && activeFiltersCount > 0 && (
          <div className="filter-note">
            <span>
              {lang === 'uk'
                ? `Активні фільтри: ${activeFiltersCount}. Показано ${filteredTasks.length} з ${activeTasks.length} завдань.`
                : `Active filters: ${activeFiltersCount}. Showing ${filteredTasks.length} of ${activeTasks.length} tasks.`}
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
        <div
          className="content-area"
          ref={contentAreaRef}
          onTouchStart={handlePullStart}
          onTouchMove={handlePullMove}
          onTouchEnd={handlePullEnd}
          onTouchCancel={resetPullGesture}
        >
          {activeTab === 'plans' && (
            isMobile ? (
              <MobilePlansView
                plans={planCalendarItems}
                activePlanId={activeTemplateId}
                lang={lang}
                onAdd={handleCreateBlankPlan}
                onArchive={handleArchivePlan}
                onOpen={id => {
                  handleTemplateSelect(id);
                  setActiveTab('grid');
                }}
                onRename={handleRenamePlan}
                onReminder={planId => openReminderCenter({ targetType: 'plan', planId })}
              />
            ) : (
              <PlansCalendarView
                plans={planCalendarItems}
                zoomLevel={zoomLevel}
                lang={lang}
                onSelect={id => {
                  handleTemplateSelect(id);
                  setActiveTab('gantt');
                }}
                onArchive={handleArchivePlan}
              />
            )
          )}

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
            isMobile ? (
              <MobileTaskList
                tasks={filteredTasks}
                lang={lang}
                teamMembers={teamMembers}
                onAdd={() => handleAddTask('todo')}
                onOpen={setSelectedTaskId}
                onUpdate={handleUpdateTask}
              />
            ) : (
              <GridView
                tasks={filteredTasks}
                updateTask={handleUpdateTask}
                addTask={handleAddTask}
                cloneTask={handleCloneTask}
                deleteTask={handleDeleteTask}
                setSelectedTaskId={setSelectedTaskId}
                lang={lang}
                teamMembers={teamMembers}
              />
            )
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard
              tasks={filteredTasks}
              updateTask={handleUpdateTask}
              setSelectedTaskId={setSelectedTaskId}
              lang={lang}
              addTask={handleAddTask}
              teamMembers={teamMembers}
            />
          )}

          {activeTab === 'workload' && (
            <WorkloadView
              tasks={filteredTasks}
              lang={lang}
              teamMembers={teamMembers}
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

        <nav className="mobile-bottom-nav" aria-label={lang === 'uk' ? 'Основна навігація' : 'Main navigation'}>
          {([
            { id: 'plans' as ActiveTab, icon: <CalendarRange size={20} />, uk: 'Плани', en: 'Plans' },
            { id: 'grid' as ActiveTab, icon: <Table size={20} />, uk: 'Завдання', en: 'Tasks' },
            { id: 'kanban' as ActiveTab, icon: <Compass size={20} />, uk: 'Дошка', en: 'Board' },
            { id: 'gantt' as ActiveTab, icon: <Calendar size={20} />, uk: 'Графік', en: 'Timeline' },
            { id: 'workload' as ActiveTab, icon: <Users size={20} />, uk: 'Команда', en: 'Team' },
          ]).map(item => (
            <button
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
              key={item.id}
            >
              {item.icon}
              <span>{lang === 'uk' ? item.uk : item.en}</span>
            </button>
          ))}
        </nav>
      </main>

      {isMobilePlanSheetOpen && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setIsMobilePlanSheetOpen(false)} />
          <section className="mobile-sheet mobile-plan-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-plans-title">
            <div className="mobile-sheet-handle" />
            <header className="mobile-sheet-header">
              <div>
                <small>{lang === 'uk' ? 'Робочий простір' : 'Workspace'}</small>
                <h2 id="mobile-plans-title">{lang === 'uk' ? 'Виберіть план' : 'Choose a plan'}</h2>
              </div>
              <button className="btn-icon" onClick={() => setIsMobilePlanSheetOpen(false)} aria-label={getTranslation(lang, 'close')}><X size={18} /></button>
            </header>
            <button className="mobile-sheet-create" onClick={() => { setIsMobilePlanSheetOpen(false); handleCreateBlankPlan(); }}>
              <Plus size={18} />
              <span><strong>{lang === 'uk' ? 'Новий план' : 'New plan'}</strong><small>{lang === 'uk' ? 'Почати з чистого аркуша' : 'Start from scratch'}</small></span>
            </button>
            <div className="mobile-sheet-list">
              {allTemplates.map(template => (
                <div className={`mobile-sheet-plan-row ${template.id === activeTemplateId ? 'active' : ''}`} key={template.id}>
                  <button
                    className="mobile-sheet-plan-main"
                    onClick={() => {
                      handleTemplateSelect(template.id);
                      setActiveTab('grid');
                      setIsMobilePlanSheetOpen(false);
                    }}
                  >
                    <span className="mobile-sheet-plan-icon">{renderTemplateIcon(template.iconName)}</span>
                    <span><strong>{getPlanTitle(template)}</strong><small>{lang === 'uk' ? template.categoryUa : template.categoryEn}</small></span>
                    {template.id === activeTemplateId && <i>{lang === 'uk' ? 'Активний' : 'Active'}</i>}
                  </button>
                  <div className="mobile-sheet-plan-actions">
                    <button onClick={() => handleRenamePlan(template.id)} aria-label={lang === 'uk' ? 'Перейменувати' : 'Rename'}><Pencil size={15} /></button>
                    <button onClick={() => handleArchivePlan(template.id)} aria-label={lang === 'uk' ? 'Архівувати' : 'Archive'}><Archive size={15} /></button>
                    <button onClick={() => handleDeletePlan(template.id)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {isMobileMenuOpen && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
          <section className="mobile-sheet mobile-actions-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-actions-title">
            <div className="mobile-sheet-handle" />
            <header className="mobile-sheet-header">
              <div>
                <small>{activeTemplateTitle}</small>
                <h2 id="mobile-actions-title">{lang === 'uk' ? 'Інструменти' : 'Tools'}</h2>
              </div>
              <button className="btn-icon" onClick={() => setIsMobileMenuOpen(false)} aria-label={getTranslation(lang, 'close')}><X size={18} /></button>
            </header>
            <div className={`mobile-sync-card mobile-sync-${cloudStatus}`}>
              {cloudStatus === 'synced' ? <Cloud size={17} /> : cloudStatus === 'error' ? <CloudOff size={17} /> : <LoaderCircle size={17} />}
              <span>
                <strong>{cloudStatus === 'synced' ? (lang === 'uk' ? 'Збережено' : 'Saved') : cloudStatus === 'error' ? (lang === 'uk' ? 'Немає синхронізації' : 'Sync unavailable') : (lang === 'uk' ? 'Синхронізація…' : 'Syncing…')}</strong>
                <small>{accountEmail}</small>
              </span>
            </div>
            <div className="mobile-action-grid">
              <button onClick={() => { setIsMobileMenuOpen(false); setIsTeamManagerOpen(true); }}><Users size={19} /><span>{lang === 'uk' ? 'Команда' : 'Team'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); openReminderCenter({ targetType: 'plan', planId: activeTemplateId }); }}><Bell size={19} /><span>{lang === 'uk' ? 'Нагадування' : 'Reminders'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); setIsIdeasOpen(true); }}><Lightbulb size={19} /><span>{lang === 'uk' ? 'Ідеї' : 'Ideas'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); void handleTogglePlanSharing(); }}>{activeSharedPlan ? <Lock size={19} /> : <Share2 size={19} />}<span>{activeSharedPlan ? (lang === 'uk' ? 'Приватний' : 'Private') : (lang === 'uk' ? 'Поділитися' : 'Share')}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); setIsArchiveOpen(true); }}><Archive size={19} /><span>{lang === 'uk' ? 'Архів' : 'Archive'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleDuplicateActivePlan(); }}><Copy size={19} /><span>{lang === 'uk' ? 'Дублювати' : 'Duplicate'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleSaveAsTemplate(); }}><Plus size={19} /><span>{lang === 'uk' ? 'Як шаблон' : 'As template'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); setIsResetConfirmOpen(true); }}><RotateCcw size={19} /><span>{lang === 'uk' ? 'Скинути' : 'Reset'}</span></button>
              <button onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}<span>{lang === 'uk' ? 'Тема' : 'Theme'}</span></button>
              <button onClick={() => setLang(value => value === 'uk' ? 'en' : 'uk')}><Languages size={19} /><span>{lang === 'uk' ? 'Мова' : 'Language'}</span></button>
              {!isInstalledApp && <button onClick={() => { setIsMobileMenuOpen(false); void handleInstallApp(); }}><Smartphone size={19} /><span>{lang === 'uk' ? 'Встановити' : 'Install'}</span></button>}
              <button onClick={handleExportJSON}><Download size={19} /><span>JSON</span></button>
              <button onClick={handleExportCSV}><FileText size={19} /><span>CSV</span></button>
              <button onClick={() => fileInputRef.current?.click()}><Upload size={19} /><span>{lang === 'uk' ? 'Імпорт' : 'Import'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); void onSignOut(); }}><LogOut size={19} /><span>{lang === 'uk' ? 'Вийти' : 'Sign out'}</span></button>
            </div>
          </section>
        </>
      )}

      {!selectedTask && (
        <TodayPanel
          groups={todayPlanGroups}
          lang={lang}
          referenceDate={today}
          onOpenPlan={handleOpenTodayPlan}
          onOpenTask={handleOpenTodayTask}
        />
      )}

      {isReminderCenterOpen && (
        <ReminderCenter
          reminders={reminders}
          plans={reminderPlans}
          defaultTarget={reminderDraftTarget}
          lang={lang}
          onClose={() => setIsReminderCenterOpen(false)}
          onCreate={handleCreateReminder}
          onDelete={handleDeleteReminder}
          onTestSound={() => { void unlockReminderSound(true); }}
          pushStatus={pushStatus}
          onEnablePush={() => { void handleEnablePush(); }}
          onDisablePush={() => { void handleDisablePush(); }}
          getTargetLabel={getReminderTargetLabel}
        />
      )}

      {isIdeasOpen && (
        <IdeasDialog
          ideas={ideas}
          plans={reminderPlans.map(plan => ({ id: plan.id, title: plan.title }))}
          lang={lang}
          onClose={() => setIsIdeasOpen(false)}
          onCreate={handleCreateIdea}
          onArchive={handleArchiveIdea}
          onDelete={handleDeleteIdea}
          onConvert={handleConvertIdeaToPlan}
        />
      )}

      {activeReminder && (
        <ReminderAlert
          reminder={activeReminder}
          targetLabel={getReminderTargetLabel(activeReminder)}
          lang={lang}
          onDone={() => handleCompleteReminder(activeReminder.id)}
          onSnooze={minutes => handleSnoozeReminder(activeReminder.id, minutes)}
        />
      )}

      {/* Task Edit Side Drawer */}
      {selectedTask && (
        <TaskDetailsDrawer
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdateTask}
          onClone={handleCloneTask}
          onDelete={handleDeleteTask}
          onArchive={handleArchiveTask}
          tasks={activeTasks}
          lang={lang}
          teamMembers={teamMembers}
          currentUserEmail={accountEmail}
          reminders={reminders.filter(reminder => reminder.planId === activeTemplateId)}
          onAddReminder={(targetType, subtaskId) => openReminderCenter({
            targetType,
            planId: activeTemplateId,
            taskId: selectedTask.id,
            subtaskId,
          })}
        />
      )}

      {/* Assignee management modal */}
      {isTeamManagerOpen && (
        <>
          <div className="dialog-backdrop" onClick={() => setIsTeamManagerOpen(false)} />
          <div className="dialog-container team-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="team-manager-title">
            <div className="team-manager-header">
              <div>
                <div className="dialog-header" id="team-manager-title">
                  {lang === 'uk' ? 'Команда і доступ' : 'Team & access'}
                </div>
                <p>{lang === 'uk' ? 'Керуйте учасниками та відкривайте їм лише вибрані плани.' : 'Manage members and share only selected plans.'}</p>
              </div>
              <button className="btn-icon" onClick={() => setIsTeamManagerOpen(false)} aria-label={getTranslation(lang, 'close')}>
                <X size={16} />
              </button>
            </div>

            {collaborationTeams.length > 0 && (
              <label className="team-selector-label">
                <span>{lang === 'uk' ? 'Активна команда' : 'Active team'}</span>
                <select className="form-control" value={selectedCollaborationTeam?.id ?? ''} onChange={event => setSelectedTeamId(event.target.value)}>
                  {collaborationTeams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}
                </select>
              </label>
            )}

            {selectedCollaborationTeam && (
              <>
                <div className="team-access-summary">
                  <Shield size={18} />
                  <span><strong>{selectedCollaborationTeam.name}</strong><small>{lang === 'uk' ? `${selectedCollaborationTeam.members.length} учасників · ваша роль: ${selectedCollaborationTeam.currentUserRole}` : `${selectedCollaborationTeam.members.length} members · your role: ${selectedCollaborationTeam.currentUserRole}`}</small></span>
                </div>
                <div className="team-member-list">
                  {selectedCollaborationTeam.members.map(member => (
                    <div className="team-member-row" key={member.userId}>
                      <span className="team-member-avatar">{member.displayName.slice(0, 2).toUpperCase()}</span>
                      <span className="team-member-copy">
                        <strong>{member.displayName}</strong>
                        <small>{member.email} · {member.role}</small>
                      </span>
                      {selectedCollaborationTeam.currentUserRole === 'owner' && member.role !== 'owner' && (
                        <button className="btn-icon danger-icon" onClick={() => void handleRemoveCollaborationMember(member.userId)} aria-label={lang === 'uk' ? 'Видалити учасника' : 'Remove member'}><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedCollaborationTeam?.currentUserRole === 'owner' && (
              <form className="team-member-form" onSubmit={event => { event.preventDefault(); void handleAddCollaborationMember(); }}>
                <input className="form-control" type="email" value={newMemberEmail} onChange={event => setNewMemberEmail(event.target.value)} placeholder={lang === 'uk' ? 'Email зареєстрованого користувача' : 'Registered user email'} required />
                <select className="form-control" value={newMemberAccess} onChange={event => setNewMemberAccess(event.target.value as Exclude<TeamRole, 'owner'>)}>
                  <option value="editor">{lang === 'uk' ? 'Редактор — може змінювати' : 'Editor — can edit'}</option>
                  <option value="viewer">{lang === 'uk' ? 'Перегляд — лише читання' : 'Viewer — read only'}</option>
                </select>
                <button className="btn btn-primary" type="submit" disabled={isCollaborationBusy}><UserPlus size={16} />{lang === 'uk' ? 'Додати до команди' : 'Add to team'}</button>
              </form>
            )}

            <form className="team-create-form" onSubmit={event => { event.preventDefault(); void handleCreateTeam(); }}>
              <input
                className="form-control"
                value={newTeamName}
                onChange={event => setNewTeamName(event.target.value)}
                placeholder={lang === 'uk' ? 'Назва нової команди' : 'New team name'}
                required
              />
              <button className="btn btn-secondary" type="submit" disabled={isCollaborationBusy}>
                <Plus size={16} />
                {lang === 'uk' ? 'Створити команду' : 'Create team'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Plans and tasks archive */}
      {isArchiveOpen && (
        <>
          <div className="dialog-backdrop" onClick={() => setIsArchiveOpen(false)} />
          <div className="dialog-container archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
            <div className="archive-dialog-header">
              <div>
                <div className="dialog-header" id="archive-title">
                  {lang === 'uk' ? 'Архів' : 'Archive'}
                </div>
                <p>{lang === 'uk' ? 'Відновлюйте плани та завдання без втрати даних.' : 'Restore plans and tasks without losing data.'}</p>
              </div>
              <button className="btn-icon" onClick={() => setIsArchiveOpen(false)} aria-label={getTranslation(lang, 'close')}>
                <X size={16} />
              </button>
            </div>

            <div className="archive-section">
              <div className="archive-section-title">
                <span>{lang === 'uk' ? 'Плани' : 'Plans'}</span>
                <strong>{archivedTemplates.length}</strong>
              </div>
              <div className="archive-list">
                {archivedTemplates.map(template => (
                  <div className="archive-row" key={template.id}>
                    <span className="archive-row-icon"><CalendarRange size={16} /></span>
                    <span className="archive-row-copy">
                      <strong>{getPlanTitle(template)}</strong>
                      <small>{lang === 'uk' ? template.categoryUa : template.categoryEn}</small>
                    </span>
                    <button className="btn btn-secondary btn-compact" onClick={() => handleRestorePlan(template.id)}>
                      <RotateCcw size={14} />
                      {lang === 'uk' ? 'Відновити' : 'Restore'}
                    </button>
                  </div>
                ))}
                {archivedTemplates.length === 0 && (
                  <div className="archive-empty">{lang === 'uk' ? 'Архівованих планів немає' : 'No archived plans'}</div>
                )}
              </div>
            </div>

            <div className="archive-section">
              <div className="archive-section-title">
                <span>{lang === 'uk' ? `Завдання: ${activeTemplateTitle}` : `Tasks: ${activeTemplateTitle}`}</span>
                <strong>{archivedTasks.length}</strong>
              </div>
              <div className="archive-list">
                {archivedTasks.map(task => (
                  <div className="archive-row" key={task.id}>
                    <span className="archive-row-color" style={{ background: task.color ?? '#6366f1' }} />
                    <span className="archive-row-copy">
                      <strong>{task.title}</strong>
                      <small>{task.startDate} — {task.endDate}</small>
                    </span>
                    <button className="btn btn-secondary btn-compact" onClick={() => handleRestoreTask(task.id)}>
                      <RotateCcw size={14} />
                      {lang === 'uk' ? 'Відновити' : 'Restore'}
                    </button>
                  </div>
                ))}
                {archivedTasks.length === 0 && (
                  <div className="archive-empty">{lang === 'uk' ? 'У поточному плані немає архівованих завдань' : 'No archived tasks in the current plan'}</div>
                )}
              </div>
            </div>
          </div>
        </>
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
