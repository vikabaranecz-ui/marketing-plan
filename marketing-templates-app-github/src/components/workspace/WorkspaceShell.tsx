import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Archive, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Command, File, FileText, FolderKanban, Home, Languages,
  Lightbulb, ListTodo, LogOut, Menu, Moon, MoreHorizontal,
  Paperclip, Plus, Search, Settings, Sun, Upload, Users, X,
} from 'lucide-react';
import type { ActiveTab, Idea, Language, MarketingTemplate, Task, WorkspaceDocument } from '../../types';
import type { GlobalTaskItem } from '../AllTasksView';
import type { PlanCalendarItem } from '../PlansCalendarView';
import './workspace.css';

export type ProjectSection = 'overview' | 'tasks' | 'board' | 'timeline' | 'files' | 'ideas';

interface WorkspaceShellProps {
  accountEmail: string;
  lang: Language;
  theme: 'light' | 'dark';
  activeTab: ActiveTab;
  activeProjectId: string;
  activeProject: MarketingTemplate;
  activeProjectTitle: string;
  activeTasks: Task[];
  projects: PlanCalendarItem[];
  archivedProjects: PlanCalendarItem[];
  archivedProjectIds: string[];
  items: GlobalTaskItem[];
  ideas: Idea[];
  documents: WorkspaceDocument[];
  remindersCount: number;
  teamMembers: { name: string }[];
  projectBoard: ReactNode;
  projectTimeline: ReactNode;
  onNavigate: (tab: ActiveTab) => void;
  onSelectProject: (projectId: string) => void;
  onOpenTask: (projectId: string, taskId: string) => void;
  onCreateTask: (title?: string) => void;
  onCreateProject: () => void;
  onCreateIdea: (draft: Pick<Idea, 'title' | 'description' | 'planId' | 'taskId' | 'reviewAt' | 'reviewIntervalDays'>) => void;
  onOpenIdeas: () => void;
  onUploadFile: (file: File, link?: Pick<WorkspaceDocument, 'planId' | 'taskId'>) => Promise<WorkspaceDocument | null>;
  onOpenFile: (document: WorkspaceDocument) => void;
  onDeleteFile: (document: WorkspaceDocument) => void;
  onRenameProject: (projectId: string) => void;
  onArchiveProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenArchive: () => void;
  onOpenReminders: () => void;
  onOpenTeam: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onSignOut: () => void;
}

const STATUS_LABELS = {
  uk: { todo: 'До роботи', in_progress: 'У роботі', in_review: 'На перевірці', done: 'Готово' },
  en: { todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done' },
};

const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayLabel = (value: string, lang: Language) => new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));

function Progress({ value }: { value: number }) {
  return <span className="ws-progress" aria-label={`${value}%`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

function StatusBadge({ status, lang }: { status: Task['status']; lang: Language }) {
  return <span className={`ws-status ws-status-${status}`}>{STATUS_LABELS[lang][status]}</span>;
}

function TaskRow({ item, lang, onOpen }: { item: GlobalTaskItem; lang: Language; onOpen: () => void }) {
  const today = localDate();
  const overdue = item.task.status !== 'done' && item.task.endDate < today;
  return (
    <button className="ws-task-row" onClick={onOpen}>
      <span className={`ws-check ${item.task.status === 'done' ? 'done' : ''}`}>{item.task.status === 'done' ? <Check size={14} /> : <Circle size={16} />}</span>
      <span className="ws-task-main"><strong>{item.task.title}</strong><small><i style={{ background: item.planColor }} />{item.planTitle}</small></span>
      <span className={`ws-date ${overdue ? 'overdue' : ''}`}><CalendarDays size={14} />{overdue ? (lang === 'uk' ? 'Прострочено' : 'Overdue') : dayLabel(item.task.endDate, lang)}</span>
      <span className="ws-owner">{item.task.assignee?.slice(0, 2).toUpperCase() || '—'}</span>
      <StatusBadge status={item.task.status} lang={lang} />
      <ChevronRight size={16} />
    </button>
  );
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
  const {
    accountEmail, lang, theme, activeTab, activeProjectId, activeProject, activeProjectTitle,
    projects, archivedProjects, archivedProjectIds, items, ideas, documents, remindersCount,
    projectBoard, projectTimeline, onNavigate, onSelectProject, onOpenTask, onCreateTask,
    onCreateProject, onCreateIdea, onOpenIdeas, onUploadFile, onOpenFile, onDeleteFile,
    onRenameProject, onArchiveProject, onDeleteProject, onOpenArchive, onOpenReminders,
    onOpenTeam, onToggleTheme, onToggleLanguage, onSignOut,
  } = props;
  const [section, setSection] = useState<ProjectSection>('overview');
  const [projectOpen, setProjectOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<'active' | 'completed' | 'archived'>('active');
  const [taskQuery, setTaskQuery] = useState('');
  const [ideaTitle, setIdeaTitle] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = localDate();
  const openItems = items.filter(item => item.task.status !== 'done');
  const dueToday = openItems.filter(item => item.task.startDate <= today && item.task.endDate >= today);
  const overdue = openItems.filter(item => item.task.endDate < today);
  const inProgress = openItems.filter(item => item.task.status === 'in_progress');
  const inReview = openItems.filter(item => item.task.status === 'in_review');
  const upcoming = openItems.filter(item => item.task.startDate > today).sort((a, b) => a.task.startDate.localeCompare(b.task.startDate));
  const activeProjectData = projects.find(project => project.id === activeProjectId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false); setQuickOpen(false); setMoreOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return { projects: [], tasks: [], ideas: [], files: [] };
    return {
      projects: projects.filter(project => `${project.title} ${project.category}`.toLocaleLowerCase().includes(deferredQuery)).slice(0, 5),
      tasks: items.filter(item => `${item.task.title} ${item.task.description} ${item.planTitle}`.toLocaleLowerCase().includes(deferredQuery)).slice(0, 8),
      ideas: ideas.filter(idea => `${idea.title} ${idea.description}`.toLocaleLowerCase().includes(deferredQuery)).slice(0, 5),
      files: documents.filter(file => file.name.toLocaleLowerCase().includes(deferredQuery)).slice(0, 5),
    };
  }, [deferredQuery, documents, ideas, items, projects]);

  const navigate = (tab: ActiveTab) => { onNavigate(tab); setMoreOpen(false); };
  const openProject = (id: string, nextSection: ProjectSection = 'overview') => {
    onSelectProject(id); setSection(nextSection); setProjectOpen(true); onNavigate('plans');
  };

  const renderToday = () => (
    <div className="ws-page ws-today">
      <header className="ws-page-heading">
        <div><span>{new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><h1>{lang === 'uk' ? 'Що робимо далі?' : 'What should we do next?'}</h1><p>{lang === 'uk' ? 'Спочатку — найважливіше на сьогодні.' : 'Start with what matters today.'}</p></div>
        <button className="ws-primary" onClick={() => onCreateTask()}><Plus size={18} />{lang === 'uk' ? 'Додати завдання' : 'Add task'}</button>
      </header>
      <div className="ws-metrics">
        {[[dueToday.length, 'На сьогодні', 'Due today'], [overdue.length, 'Прострочено', 'Overdue'], [inProgress.length, 'У роботі', 'In progress'], [inReview.length, 'На перевірці', 'In review']].map(([value, uk, en], index) => <div className={index === 1 && Number(value) > 0 ? 'danger' : ''} key={String(uk)}><strong>{value}</strong><span>{lang === 'uk' ? uk : en}</span></div>)}
      </div>
      <section className="ws-panel">
        <div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Пріоритети' : 'Priorities'}</h2><p>{lang === 'uk' ? 'Сьогодні та прострочені' : 'Today and overdue'}</p></div><button onClick={() => navigate('all_tasks')}>{lang === 'uk' ? 'Усі завдання' : 'All tasks'}<ChevronRight size={15} /></button></div>
        <div className="ws-task-list">{[...overdue, ...dueToday.filter(item => !overdue.includes(item))].slice(0, 8).map(item => <TaskRow item={item} lang={lang} onOpen={() => onOpenTask(item.planId, item.task.id)} key={`${item.planId}-${item.task.id}`} />)}{dueToday.length === 0 && overdue.length === 0 ? <div className="ws-empty"><CheckCircle2 /><strong>{lang === 'uk' ? 'На сьогодні все виконано' : 'All clear for today'}</strong><span>{lang === 'uk' ? 'Можна взяти наступне завдання.' : 'You can pick the next task.'}</span></div> : null}</div>
      </section>
      <section className="ws-panel">
        <div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Активні проєкти' : 'Active projects'}</h2><p>{projects.length} {lang === 'uk' ? 'проєктів' : 'projects'}</p></div><button onClick={() => navigate('plans')}>{lang === 'uk' ? 'Відкрити всі' : 'View all'}<ChevronRight size={15} /></button></div>
        <div className="ws-project-strip">{projects.slice(0, 6).map(project => <button onClick={() => openProject(project.id)} key={project.id}><span className="ws-project-icon" style={{ background: project.color }}><FolderKanban size={18} /></span><span><strong>{project.title}</strong><small>{project.taskCount} {lang === 'uk' ? 'завдань' : 'tasks'} · {project.endDate}</small><Progress value={project.progress} /></span><b>{project.progress}%</b></button>)}</div>
      </section>
    </div>
  );

  const filteredProjects = (projectFilter === 'archived' ? archivedProjects : projects).filter(project => {
    const archived = archivedProjectIds.includes(project.id);
    const completed = project.progress === 100;
    const matchesFilter = projectFilter === 'archived' ? archived : projectFilter === 'completed' ? completed && !archived : !completed && !archived;
    return matchesFilter && `${project.title} ${project.category}`.toLocaleLowerCase().includes(projectQuery.toLocaleLowerCase());
  });

  const renderProjects = () => projectOpen ? renderProject() : (
    <div className="ws-page">
      <header className="ws-page-heading"><div><span>{lang === 'uk' ? 'Робочий простір' : 'Workspace'}</span><h1>{lang === 'uk' ? 'Проєкти' : 'Projects'}</h1><p>{lang === 'uk' ? 'Уся робота згрупована за результатом.' : 'All work grouped by outcome.'}</p></div><button className="ws-primary" onClick={onCreateProject}><Plus size={18} />{lang === 'uk' ? 'Новий проєкт' : 'New project'}</button></header>
      <div className="ws-toolbar"><div className="ws-segmented">{(['active', 'completed', 'archived'] as const).map(value => <button className={projectFilter === value ? 'active' : ''} onClick={() => setProjectFilter(value)} key={value}>{value === 'active' ? (lang === 'uk' ? 'Активні' : 'Active') : value === 'completed' ? (lang === 'uk' ? 'Завершені' : 'Completed') : (lang === 'uk' ? 'Архів' : 'Archived')}</button>)}</div><label className="ws-search-field"><Search size={16} /><input value={projectQuery} onChange={event => setProjectQuery(event.target.value)} placeholder={lang === 'uk' ? 'Знайти проєкт…' : 'Find a project…'} /></label></div>
      <div className="ws-project-table"><div className="ws-project-table-head"><span>{lang === 'uk' ? 'Проєкт' : 'Project'}</span><span>{lang === 'uk' ? 'Статус' : 'Status'}</span><span>{lang === 'uk' ? 'Прогрес' : 'Progress'}</span><span>{lang === 'uk' ? 'Дедлайн' : 'Deadline'}</span><span>{lang === 'uk' ? 'Наступне' : 'Next task'}</span><span /></div>{filteredProjects.map(project => { const nextTask = project.tasks.filter(task => task.status !== 'done').sort((a, b) => a.endDate.localeCompare(b.endDate))[0]; return <button className="ws-project-row" onClick={() => openProject(project.id)} key={project.id}><span className="ws-project-name"><i style={{ background: project.color }}><FolderKanban size={17} /></i><span><strong>{project.title}</strong><small>{activeProject.id === project.id ? activeProject.client || project.category : project.category}</small></span></span><StatusBadge status={project.progress === 100 ? 'done' : project.progress > 0 ? 'in_progress' : 'todo'} lang={lang} /><span className="ws-project-progress"><Progress value={project.progress} /><b>{project.progress}%</b></span><span>{dayLabel(project.endDate, lang)}</span><span className="ws-next-task">{nextTask?.title || (lang === 'uk' ? 'Усе готово' : 'All done')}</span><ChevronRight size={16} /></button>; })}{filteredProjects.length === 0 ? <div className="ws-empty"><FolderKanban /><strong>{lang === 'uk' ? 'Тут поки порожньо' : 'Nothing here yet'}</strong></div> : null}</div>
    </div>
  );

  const renderProject = () => {
    const projectItems = items.filter(item => item.planId === activeProjectId);
    const projectIdeas = ideas.filter(idea => idea.planId === activeProjectId);
    const projectFiles = documents.filter(file => file.planId === activeProjectId);
    const nextTask = projectItems.filter(item => item.task.status !== 'done').sort((a, b) => a.task.endDate.localeCompare(b.task.endDate))[0];
    return <div className="ws-page ws-project-page">
      <button className="ws-back-link" onClick={() => setProjectOpen(false)}><ChevronRight size={15} />{lang === 'uk' ? 'Усі проєкти' : 'All projects'}</button>
      <header className="ws-project-header"><div className="ws-project-title"><span className="ws-project-icon large" style={{ background: activeProjectData?.color }}><FolderKanban size={22} /></span><div><span>{activeProject.client || activeProjectData?.category}</span><h1>{activeProjectTitle}</h1><p>{activeProject.descriptionUa}</p></div></div><div className="ws-project-actions"><button className="ws-primary" onClick={() => onCreateTask()}><Plus size={17} />{lang === 'uk' ? 'Додати завдання' : 'Add task'}</button><details><summary><MoreHorizontal /></summary><div><button onClick={() => onRenameProject(activeProjectId)}>{lang === 'uk' ? 'Перейменувати' : 'Rename'}</button><button onClick={() => onArchiveProject(activeProjectId)}>{lang === 'uk' ? 'Архівувати' : 'Archive'}</button><button className="danger" onClick={() => onDeleteProject(activeProjectId)}>{lang === 'uk' ? 'Видалити' : 'Delete'}</button></div></details></div></header>
      <div className="ws-project-meta"><span><Users size={15} />{activeProject.owner || accountEmail}</span><span><CalendarDays size={15} />{activeProjectData?.startDate} — {activeProject.deadline || activeProjectData?.endDate}</span><span><Progress value={activeProjectData?.progress || 0} />{activeProjectData?.progress || 0}%</span></div>
      <nav className="ws-project-tabs" aria-label={lang === 'uk' ? 'Розділи проєкту' : 'Project sections'}><select value={section} onChange={event => setSection(event.target.value as ProjectSection)}>{(['overview', 'tasks', 'board', 'timeline', 'files', 'ideas'] as const).map(value => <option value={value} key={value}>{value === 'overview' ? (lang === 'uk' ? 'Огляд' : 'Overview') : value === 'tasks' ? (lang === 'uk' ? 'Завдання' : 'Tasks') : value === 'board' ? (lang === 'uk' ? 'Дошка' : 'Board') : value === 'timeline' ? 'Timeline' : value === 'files' ? (lang === 'uk' ? 'Файли' : 'Files') : (lang === 'uk' ? 'Ідеї' : 'Ideas')}</option>)}</select>{(['overview', 'tasks', 'board', 'timeline', 'files', 'ideas'] as const).map(value => <button className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value === 'overview' ? (lang === 'uk' ? 'Огляд' : 'Overview') : value === 'tasks' ? (lang === 'uk' ? 'Завдання' : 'Tasks') : value === 'board' ? (lang === 'uk' ? 'Дошка' : 'Board') : value === 'timeline' ? 'Timeline' : value === 'files' ? (lang === 'uk' ? 'Файли' : 'Files') : (lang === 'uk' ? 'Ідеї' : 'Ideas')}</button>)}</nav>
      {section === 'overview' ? <div className="ws-overview-grid"><section className="ws-panel ws-next-panel"><div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Наступне завдання' : 'Next task'}</h2><p>{lang === 'uk' ? 'Продовжуйте звідси' : 'Continue from here'}</p></div></div>{nextTask ? <TaskRow item={nextTask} lang={lang} onOpen={() => onOpenTask(nextTask.planId, nextTask.task.id)} /> : <div className="ws-empty"><CheckCircle2 /><strong>{lang === 'uk' ? 'Проєкт завершено' : 'Project complete'}</strong></div>}</section><section className="ws-panel"><div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Стан роботи' : 'Work status'}</h2></div></div><div className="ws-status-summary">{(['todo', 'in_progress', 'in_review', 'done'] as const).map(status => <div key={status}><span>{projectItems.filter(item => item.task.status === status).length}</span><StatusBadge status={status} lang={lang} /></div>)}</div></section><section className="ws-panel ws-wide"><div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Останні завдання' : 'Recent tasks'}</h2></div><button onClick={() => setSection('tasks')}>{lang === 'uk' ? 'Переглянути всі' : 'View all'}<ChevronRight size={15} /></button></div>{projectItems.slice(0, 5).map(item => <TaskRow item={item} lang={lang} onOpen={() => onOpenTask(item.planId, item.task.id)} key={item.task.id} />)}</section></div> : null}
      {section === 'tasks' ? <section className="ws-panel"><div className="ws-toolbar"><label className="ws-search-field"><Search size={16} /><input value={taskQuery} onChange={event => setTaskQuery(event.target.value)} placeholder={lang === 'uk' ? 'Знайти завдання…' : 'Find a task…'} /></label><button className="ws-secondary" onClick={() => onCreateTask()}><Plus size={16} />{lang === 'uk' ? 'Додати' : 'Add'}</button></div><div className="ws-task-list">{projectItems.filter(item => item.task.title.toLocaleLowerCase().includes(taskQuery.toLocaleLowerCase())).map(item => <TaskRow item={item} lang={lang} onOpen={() => onOpenTask(item.planId, item.task.id)} key={item.task.id} />)}</div></section> : null}
      {section === 'board' ? <div className="ws-embedded-view">{projectBoard}</div> : null}
      {section === 'timeline' ? <div className="ws-embedded-view">{projectTimeline}</div> : null}
      {section === 'files' ? renderFiles(projectFiles, activeProjectId) : null}
      {section === 'ideas' ? renderIdeas(projectIdeas, activeProjectId) : null}
    </div>;
  };

  const renderTasks = () => <div className="ws-page"><header className="ws-page-heading"><div><span>{lang === 'uk' ? 'Усі проєкти' : 'All projects'}</span><h1>{lang === 'uk' ? 'Мої завдання' : 'My tasks'}</h1><p>{openItems.length} {lang === 'uk' ? 'незавершених' : 'unfinished'}</p></div><button className="ws-primary" onClick={() => onCreateTask()}><Plus size={18} />{lang === 'uk' ? 'Додати завдання' : 'Add task'}</button></header>{[[overdue, 'Прострочено', 'Overdue'], [dueToday, 'Сьогодні', 'Today'], [upcoming, 'Далі', 'Upcoming']].map(([group, uk, en]) => <section className="ws-panel ws-task-group" key={String(uk)}><div className="ws-section-heading"><div><h2>{lang === 'uk' ? uk as string : en as string}</h2><p>{(group as GlobalTaskItem[]).length}</p></div></div>{(group as GlobalTaskItem[]).slice(0, 30).map(item => <TaskRow item={item} lang={lang} onOpen={() => onOpenTask(item.planId, item.task.id)} key={`${item.planId}-${item.task.id}`} />)}{(group as GlobalTaskItem[]).length === 0 ? <div className="ws-empty compact"><CheckCircle2 /><span>{lang === 'uk' ? 'Нічого немає' : 'Nothing here'}</span></div> : null}</section>)}</div>;

  const renderCalendar = () => {
    const sorted = [...items].filter(item => item.task.status !== 'done').sort((a, b) => a.task.endDate.localeCompare(b.task.endDate));
    const grouped = new Map<string, GlobalTaskItem[]>();
    sorted.forEach(item => grouped.set(item.task.endDate, [...(grouped.get(item.task.endDate) || []), item]));
    return <div className="ws-page"><header className="ws-page-heading"><div><span>{new Date().getFullYear()}</span><h1>{lang === 'uk' ? 'Календар' : 'Calendar'}</h1><p>{lang === 'uk' ? 'Дедлайни та важливі дати' : 'Deadlines and milestones'}</p></div></header><div className="ws-calendar-layout"><aside><strong>{new Date().getDate()}</strong><span>{new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', { month: 'long', weekday: 'long' }).format(new Date())}</span><small>{dueToday.length} {lang === 'uk' ? 'на сьогодні' : 'due today'}</small></aside><section>{[...grouped.entries()].slice(0, 18).map(([date, dayItems]) => <div className={`ws-agenda-day ${date === today ? 'today' : ''}`} key={date}><div><strong>{dayLabel(date, lang)}</strong><small>{date === today ? (lang === 'uk' ? 'Сьогодні' : 'Today') : new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))}</small></div><div>{dayItems.map(item => <TaskRow item={item} lang={lang} onOpen={() => onOpenTask(item.planId, item.task.id)} key={`${item.planId}-${item.task.id}`} />)}</div></div>)}</section></div></div>;
  };

  function renderIdeas(list = ideas, planId?: string) {
    return <section className="ws-panel ws-library"><div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Ідеї' : 'Ideas'}</h2><p>{lang === 'uk' ? 'Швидко запишіть, розберете пізніше.' : 'Capture now, organize later.'}</p></div><button onClick={onOpenIdeas}>{lang === 'uk' ? 'Усі дії' : 'All actions'}<ChevronRight size={15} /></button></div><form className="ws-idea-capture" onSubmit={event => { event.preventDefault(); if (!ideaTitle.trim()) return; onCreateIdea({ title: ideaTitle.trim(), description: '', planId, taskId: undefined, reviewAt: undefined, reviewIntervalDays: undefined }); setIdeaTitle(''); }}><Lightbulb size={18} /><input value={ideaTitle} onChange={event => setIdeaTitle(event.target.value)} placeholder={lang === 'uk' ? 'Записати ідею…' : 'Capture an idea…'} /><button type="submit"><Plus size={17} />{lang === 'uk' ? 'Додати' : 'Add'}</button></form><div className="ws-idea-grid">{list.filter(idea => idea.status !== 'archived').map(idea => <article key={idea.id}><span><Lightbulb size={16} /></span><div><strong>{idea.title}</strong><p>{idea.description || (lang === 'uk' ? 'Без опису' : 'No description')}</p><small>{idea.planId ? projects.find(project => project.id === idea.planId)?.title : (lang === 'uk' ? 'Без проєкту' : 'No project')}</small></div></article>)}</div></section>;
  }

  function renderFiles(list = documents, planId?: string) {
    return <section className="ws-panel ws-library"><div className="ws-section-heading"><div><h2>{lang === 'uk' ? 'Файли' : 'Files'}</h2><p>{lang === 'uk' ? 'Документи, фото, PDF та таблиці' : 'Documents, images, PDFs and sheets'}</p></div><button className="ws-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={16} />{lang === 'uk' ? 'Завантажити' : 'Upload'}</button></div><input ref={fileInputRef} className="ws-hidden-input" type="file" onChange={event => { const file = event.target.files?.[0]; if (file) void onUploadFile(file, planId ? { planId, taskId: undefined } : undefined); event.target.value = ''; }} /><div className="ws-file-list">{list.map(document => <div key={document.id}><span className="ws-file-icon">{document.mimeType.includes('image') ? <Paperclip /> : <FileText />}</span><button onClick={() => onOpenFile(document)}><strong>{document.name}</strong><small>{document.planId ? projects.find(project => project.id === document.planId)?.title : (lang === 'uk' ? 'Без проєкту' : 'No project')} · {Math.max(1, Math.round(document.size / 1024))} KB</small></button><button className="ws-file-delete" onClick={() => onDeleteFile(document)}><X size={16} /></button></div>)}</div>{list.length === 0 ? <div className="ws-empty"><File /><strong>{lang === 'uk' ? 'Файлів ще немає' : 'No files yet'}</strong></div> : null}</section>;
  }

  const content = activeTab === 'home' ? renderToday() : activeTab === 'plans' ? renderProjects() : activeTab === 'all_tasks' ? renderTasks() : activeTab === 'calendar' ? renderCalendar() : activeTab === 'ideas' ? <div className="ws-page"><header className="ws-page-heading"><div><span>{lang === 'uk' ? 'Бібліотека' : 'Library'}</span><h1>{lang === 'uk' ? 'Ідеї' : 'Ideas'}</h1></div></header>{renderIdeas()}</div> : activeTab === 'files' || activeTab === 'notes' ? <div className="ws-page"><header className="ws-page-heading"><div><span>{lang === 'uk' ? 'Бібліотека' : 'Library'}</span><h1>{lang === 'uk' ? 'Файли' : 'Files'}</h1></div></header>{renderFiles()}</div> : renderToday();

  return <div className="workspace-v2">
    <aside className="ws-sidebar"><div className="ws-brand"><img src="/icons/marketing-plan-192.png" alt="" /><span><strong>Marketing</strong><small>Workspace</small></span></div><nav><p>WORKSPACE</p><button className={activeTab === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home />{lang === 'uk' ? 'Сьогодні' : 'Today'}{dueToday.length ? <b>{dueToday.length}</b> : null}</button><button className={activeTab === 'plans' ? 'active' : ''} onClick={() => { setProjectOpen(false); navigate('plans'); }}><FolderKanban />{lang === 'uk' ? 'Проєкти' : 'Projects'}</button><button className={activeTab === 'all_tasks' ? 'active' : ''} onClick={() => navigate('all_tasks')}><ListTodo />{lang === 'uk' ? 'Мої завдання' : 'My tasks'}{overdue.length ? <b className="danger">{overdue.length}</b> : null}</button><button className={activeTab === 'calendar' ? 'active' : ''} onClick={() => navigate('calendar')}><CalendarDays />{lang === 'uk' ? 'Календар' : 'Calendar'}</button><p>LIBRARY</p><button className={activeTab === 'ideas' ? 'active' : ''} onClick={() => navigate('ideas')}><Lightbulb />{lang === 'uk' ? 'Ідеї' : 'Ideas'}</button><button className={activeTab === 'files' || activeTab === 'notes' ? 'active' : ''} onClick={() => navigate('files')}><FileText />{lang === 'uk' ? 'Файли' : 'Files'}</button></nav><div className="ws-sidebar-bottom"><button onClick={() => setMoreOpen(true)}><Settings />{lang === 'uk' ? 'Налаштування' : 'Settings'}</button><div className="ws-account"><span>{accountEmail.slice(0, 2).toUpperCase()}</span><div><strong>{accountEmail.split('@')[0]}</strong><small>{accountEmail}</small></div></div></div></aside>
    <main className="ws-main"><header className="ws-topbar"><button className="ws-mobile-menu" onClick={() => setMoreOpen(true)}><Menu /></button><button className="ws-project-picker" onClick={() => { setProjectOpen(false); navigate('plans'); }}>{activeProjectTitle}<ChevronDown size={15} /></button><button className="ws-global-search" onClick={() => setSearchOpen(true)}><Search size={16} /><span>{lang === 'uk' ? 'Знайти будь-що…' : 'Find anything…'}</span><kbd><Command size={12} />K</kbd></button><button className="ws-icon-button" onClick={onOpenReminders} aria-label={lang === 'uk' ? 'Нагадування' : 'Reminders'}><Bell />{remindersCount ? <b>{remindersCount}</b> : null}</button><div className="ws-quick-wrap"><button className="ws-primary ws-global-add" onClick={() => setQuickOpen(value => !value)}><Plus />{lang === 'uk' ? 'Додати' : 'Add'}</button>{quickOpen ? <div className="ws-popover ws-quick-menu"><button onClick={() => { setQuickOpen(false); onCreateTask(); }}><ListTodo />{lang === 'uk' ? 'Завдання' : 'Task'}</button><button onClick={() => { setQuickOpen(false); navigate('ideas'); }}><Lightbulb />{lang === 'uk' ? 'Ідею' : 'Idea'}</button><button onClick={() => { setQuickOpen(false); fileInputRef.current?.click(); }}><Upload />{lang === 'uk' ? 'Файл' : 'File'}</button></div> : null}</div></header><div className="ws-content">{content}</div></main>
    <nav className="ws-mobile-nav"><button className={activeTab === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home /><span>{lang === 'uk' ? 'Сьогодні' : 'Today'}</span></button><button className={activeTab === 'plans' ? 'active' : ''} onClick={() => { setProjectOpen(false); navigate('plans'); }}><FolderKanban /><span>{lang === 'uk' ? 'Проєкти' : 'Projects'}</span></button><button className="ws-mobile-add" onClick={() => setQuickOpen(value => !value)}><Plus /></button><button className={activeTab === 'all_tasks' ? 'active' : ''} onClick={() => navigate('all_tasks')}><ListTodo /><span>{lang === 'uk' ? 'Завдання' : 'Tasks'}</span></button><button onClick={() => setMoreOpen(true)}><MoreHorizontal /><span>{lang === 'uk' ? 'Ще' : 'More'}</span></button></nav>
    {quickOpen ? <div className="ws-mobile-quick"><button onClick={() => { setQuickOpen(false); onCreateTask(); }}><ListTodo />{lang === 'uk' ? 'Нове завдання' : 'New task'}</button><button onClick={() => { setQuickOpen(false); navigate('ideas'); }}><Lightbulb />{lang === 'uk' ? 'Записати ідею' : 'Capture idea'}</button><button onClick={() => { setQuickOpen(false); fileInputRef.current?.click(); }}><Upload />{lang === 'uk' ? 'Завантажити файл' : 'Upload file'}</button></div> : null}
    {moreOpen ? <><button className="ws-overlay" onClick={() => setMoreOpen(false)} aria-label="Close" /><aside className="ws-more-sheet"><header><div><strong>{lang === 'uk' ? 'Ще' : 'More'}</strong><small>{accountEmail}</small></div><button onClick={() => setMoreOpen(false)}><X /></button></header><nav><button onClick={() => navigate('calendar')}><CalendarDays />{lang === 'uk' ? 'Календар' : 'Calendar'}</button><button onClick={() => navigate('ideas')}><Lightbulb />{lang === 'uk' ? 'Ідеї' : 'Ideas'}</button><button onClick={() => navigate('files')}><FileText />{lang === 'uk' ? 'Файли' : 'Files'}</button><button onClick={onOpenTeam}><Users />{lang === 'uk' ? 'Команда' : 'Team'}</button><button onClick={onOpenReminders}><Bell />{lang === 'uk' ? 'Нагадування' : 'Reminders'}</button><button onClick={onOpenArchive}><Archive />{lang === 'uk' ? 'Архів' : 'Archive'}</button><button onClick={onToggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}{lang === 'uk' ? 'Тема' : 'Theme'}</button><button onClick={onToggleLanguage}><Languages />{lang === 'uk' ? 'English' : 'Українська'}</button><button onClick={onSignOut}><LogOut />{lang === 'uk' ? 'Вийти' : 'Sign out'}</button></nav></aside></> : null}
    {searchOpen ? <><button className="ws-overlay" onClick={() => setSearchOpen(false)} aria-label="Close" /><section className="ws-command"><header><Search /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'uk' ? 'Проєкти, завдання, ідеї, файли…' : 'Projects, tasks, ideas, files…'} /><button onClick={() => setSearchOpen(false)}><X /></button></header><div>{!query ? <div className="ws-command-empty"><Command />{lang === 'uk' ? 'Почніть вводити назву' : 'Start typing a name'}</div> : null}{searchResults.projects.length ? <section><p>{lang === 'uk' ? 'Проєкти' : 'Projects'}</p>{searchResults.projects.map(project => <button onClick={() => { setSearchOpen(false); openProject(project.id); }} key={project.id}><FolderKanban /><span><strong>{project.title}</strong><small>{project.category}</small></span></button>)}</section> : null}{searchResults.tasks.length ? <section><p>{lang === 'uk' ? 'Завдання' : 'Tasks'}</p>{searchResults.tasks.map(item => <button onClick={() => { setSearchOpen(false); onOpenTask(item.planId, item.task.id); }} key={`${item.planId}-${item.task.id}`}><ListTodo /><span><strong>{item.task.title}</strong><small>{item.planTitle}</small></span></button>)}</section> : null}{searchResults.ideas.length ? <section><p>{lang === 'uk' ? 'Ідеї' : 'Ideas'}</p>{searchResults.ideas.map(idea => <button onClick={() => { setSearchOpen(false); navigate('ideas'); }} key={idea.id}><Lightbulb /><span><strong>{idea.title}</strong><small>{idea.description}</small></span></button>)}</section> : null}{searchResults.files.length ? <section><p>{lang === 'uk' ? 'Файли' : 'Files'}</p>{searchResults.files.map(file => <button onClick={() => { setSearchOpen(false); onOpenFile(file); }} key={file.id}><FileText /><span><strong>{file.name}</strong><small>{file.mimeType}</small></span></button>)}</section> : null}</div></section></> : null}
  </div>;
}
