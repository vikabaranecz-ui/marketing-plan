import {
  BookOpen, Camera, ExternalLink, FileSpreadsheet, FileText, Folder, FolderOpen, FolderPlus,
  Link2, NotebookPen, Paperclip, PenLine, Pencil, Plus, Save, ScanText,
  Search, SlidersHorizontal, Trash2, Upload, X,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { recognizeHandwriting } from '../lib/handwritingOcr';
import type { Language, WorkspaceDocument, WorkspaceNote, WorkspaceNotebook } from '../types';
import HandwritingInputDialog from './HandwritingInputDialog';
import ExcelEditorDialog from './ExcelEditorDialog';

interface PlanOption { id: string; title: string }
interface TaskOption { id: string; title: string; planId: string; planTitle: string }
type DocumentLink = Pick<WorkspaceDocument, 'noteId' | 'notebookId' | 'planId' | 'taskId'>;

interface KnowledgeHubProps {
  lang: Language;
  notes: WorkspaceNote[];
  notebooks: WorkspaceNotebook[];
  documents: WorkspaceDocument[];
  plans: PlanOption[];
  tasks: TaskOption[];
  isUploading: boolean;
  onCreateNote: (notebookId?: string) => WorkspaceNote;
  onSaveNote: (note: WorkspaceNote) => void;
  onDeleteNote: (noteId: string) => void;
  onCreateNotebook: (name: string) => WorkspaceNotebook;
  onUpdateNotebook: (notebook: WorkspaceNotebook) => void;
  onDeleteNotebook: (notebookId: string) => void;
  onUpload: (file: File, link: DocumentLink) => Promise<WorkspaceDocument | null>;
  onOpenDocument: (document: WorkspaceDocument) => void;
  onLoadDocument: (document: WorkspaceDocument) => Promise<ArrayBuffer>;
  onSaveExcelDocument: (document: WorkspaceDocument, file: File) => Promise<void>;
  onRenameDocument: (documentId: string, name: string) => void;
  onDeleteDocument: (document: WorkspaceDocument) => void;
  onLinkDocument: (documentId: string, link: Partial<DocumentLink>) => void;
}

type FilterValue = 'all' | 'unlinked' | string;
const EXCEL_FILE_TYPES = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

const isExcelDocument = (document: WorkspaceDocument) =>
  /\.(xlsx|xls)$/i.test(document.name)
  || document.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  || document.mimeType === 'application/vnd.ms-excel';

export default function KnowledgeHub({
  lang, notes, notebooks, documents, plans, tasks, isUploading,
  onCreateNote, onSaveNote, onDeleteNote, onCreateNotebook, onUpdateNotebook,
  onDeleteNotebook, onUpload, onOpenDocument, onLoadDocument, onSaveExcelDocument, onRenameDocument, onDeleteDocument, onLinkDocument,
}: KnowledgeHubProps) {
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id ?? '');
  const [draft, setDraft] = useState<WorkspaceNote | null>(notes[0] ?? null);
  const [notebookFilter, setNotebookFilter] = useState<FilterValue>('all');
  const [planFilter, setPlanFilter] = useState<FilterValue>('all');
  const [taskFilter, setTaskFilter] = useState<FilterValue>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [handwritingOpen, setHandwritingOpen] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState('');
  const [excelDocument, setExcelDocument] = useState<WorkspaceDocument | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ocrPhotoRef = useRef<HTMLInputElement>(null);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.toLocaleLowerCase().trim());

  const taskFilterOptions = useMemo(
    () => tasks.filter(task => planFilter === 'all' || planFilter === 'unlinked' || task.planId === planFilter),
    [planFilter, tasks],
  );
  const activeNotebook = notebooks.find(notebook => notebook.id === notebookFilter);
  const activeNotebookTasks = activeNotebook?.planId ? tasks.filter(task => task.planId === activeNotebook.planId) : tasks;
  const draftTasks = draft?.planId ? tasks.filter(task => task.planId === draft.planId) : [];
  const activeFilterCount = Number(notebookFilter !== 'all') + Number(planFilter !== 'all') + Number(taskFilter !== 'all');
  const attachments = draft ? documents.filter(document => document.noteId === draft.id) : [];
  const unfiledDocuments = draft ? documents.filter(document => !document.noteId && (!activeNotebook || document.notebookId === activeNotebook.id)) : [];
  const folderDocuments = activeNotebook
    ? documents.filter(document => document.notebookId === activeNotebook.id && Boolean(document.noteId) && document.noteId !== draft?.id)
    : [];

  const filteredNotes = notes.filter(note => {
    const matchesQuery = !deferredQuery || `${note.title} ${note.content} ${note.tags.join(' ')}`.toLocaleLowerCase().includes(deferredQuery);
    const matchesNotebook = notebookFilter === 'all' || (notebookFilter === 'unlinked' ? !note.notebookId : note.notebookId === notebookFilter);
    const matchesPlan = planFilter === 'all' || (planFilter === 'unlinked' ? !note.planId : note.planId === planFilter);
    const matchesTask = taskFilter === 'all' || (taskFilter === 'unlinked' ? !note.taskId : note.taskId === taskFilter);
    return matchesQuery && matchesNotebook && matchesPlan && matchesTask;
  });

  useEffect(() => {
    if (draft || selectedNoteId || notes.length === 0) return;
    setSelectedNoteId(notes[0].id);
    setDraft(notes[0]);
  }, [draft, notes, selectedNoteId]);

  const selectNote = (note: WorkspaceNote) => { setSelectedNoteId(note.id); setDraft(note); };
  const openNotebook = (notebookId: string) => {
    setNotebookFilter(notebookId);
    const firstPage = notes.find(note => note.notebookId === notebookId);
    setSelectedNoteId(firstPage?.id ?? '');
    setDraft(firstPage ?? null);
  };
  const openPageCollection = (filter: 'all' | 'unlinked') => {
    setNotebookFilter(filter);
    const firstPage = filter === 'all' ? notes[0] : notes.find(note => !note.notebookId);
    setSelectedNoteId(firstPage?.id ?? '');
    setDraft(firstPage ?? null);
  };
  const editNote = (note: WorkspaceNote) => {
    selectNote(note);
    window.requestAnimationFrame(() => { titleRef.current?.focus(); titleRef.current?.select(); });
  };
  const deleteNote = (note: WorkspaceNote) => {
    if (!confirm(lang === 'uk' ? `Видалити нотатку «${note.title || 'Без назви'}»?` : `Delete “${note.title || 'Untitled'}”?`)) return;
    onDeleteNote(note.id);
    if (draft?.id === note.id) { setDraft(null); setSelectedNoteId(''); }
  };
  const createNote = () => {
    const targetNotebookId = activeNotebook?.id ?? draft?.notebookId;
    if (!targetNotebookId) {
      alert(lang === 'uk' ? 'Спочатку відкрийте або створіть папку.' : 'Open or create a folder first.');
      return;
    }
    const note = onCreateNote(targetNotebookId);
    setNotebookFilter(targetNotebookId);
    setSelectedNoteId(note.id);
    setDraft(note);
  };
  const createNotebook = () => {
    const name = prompt(lang === 'uk' ? 'Назва нової папки' : 'New folder name')?.trim();
    if (!name) return;
    const notebook = onCreateNotebook(name);
    setNotebookFilter(notebook.id);
    setSelectedNoteId('');
    setDraft(null);
    setPlanFilter('all');
    setTaskFilter('all');
  };
  const renameNotebook = (notebook: WorkspaceNotebook) => {
    const name = prompt(lang === 'uk' ? 'Нова назва папки' : 'New folder name', notebook.name)?.trim();
    if (name && name !== notebook.name) onUpdateNotebook({ ...notebook, name });
  };
  const deleteNotebook = (notebook: WorkspaceNotebook) => {
    if (!confirm(lang === 'uk' ? `Видалити папку «${notebook.name}»? Сторінки та файли залишаться.` : `Delete “${notebook.name}”? Pages and files will be kept.`)) return;
    onDeleteNotebook(notebook.id);
    if (notebookFilter === notebook.id) setNotebookFilter('all');
  };
  const clearFilters = () => { setNotebookFilter('all'); setPlanFilter('all'); setTaskFilter('all'); setQuery(''); };
  const documentLink = (): DocumentLink => ({
    noteId: draft?.id,
    notebookId: draft?.notebookId,
    planId: draft?.planId,
    taskId: draft?.taskId,
  });
  const uploadFile = async (file?: File) => {
    if (!file || !draft) return;
    const uploaded = await onUpload(file, documentLink());
    if (uploaded && isExcelDocument(uploaded)) setExcelDocument(uploaded);
  };
  const attachExisting = (document: WorkspaceDocument) => {
    if (!draft) return;
    onLinkDocument(document.id, documentLink());
  };
  const renameDocument = (document: WorkspaceDocument) => {
    const name = prompt(lang === 'uk' ? 'Нова назва файлу' : 'New file name', document.name)?.trim();
    if (name && name !== document.name) onRenameDocument(document.id, name);
  };
  const scanHandwriting = async (file?: File) => {
    if (!file || !draft) return;
    setOcrError('');
    setOcrProgress(0);
    onUpload(file, documentLink());
    try {
      const text = await recognizeHandwriting(file, 'ukr+eng', setOcrProgress);
      if (!text) throw new Error('No text recognized');
      setDraft(previous => previous ? { ...previous, content: `${previous.content}${previous.content ? '\n\n' : ''}${text}` } : previous);
    } catch (error) {
      console.error('Handwriting recognition failed', error);
      setOcrError(lang === 'uk' ? 'Не вдалося розпізнати текст. Спробуйте чіткіше фото.' : 'Could not recognize text. Try a clearer photo.');
    } finally {
      setOcrProgress(null);
    }
  };

  return (
    <section className="knowledge-hub">
      <header className="simple-page-header">
        <div><span>{lang === 'uk' ? 'Ваш простір знань' : 'Your knowledge space'}</span><h1>{lang === 'uk' ? 'Папки та сторінки' : 'Folders & pages'}</h1><p>{lang === 'uk' ? 'У кожній папці створюйте окремі сторінки, а файли залишаться прив’язаними до цієї папки.' : 'Create separate pages in every folder; uploaded files stay linked to that folder.'}</p></div>
        <button className="btn btn-primary" onClick={createNote}><Plus size={16} />{lang === 'uk' ? 'Нова сторінка' : 'New page'}</button>
      </header>

      <div className="knowledge-toolbar">
        <div className="knowledge-tabs"><button className="active"><NotebookPen size={16} />{lang === 'uk' ? 'Сторінки' : 'Pages'} <span>{notes.length}</span></button></div>
        <label className="knowledge-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'uk' ? 'Знайти нотатку…' : 'Find a note…'} /></label>
        <button className={`knowledge-filter-toggle ${filtersOpen || activeFilterCount ? 'active' : ''}`} onClick={() => setFiltersOpen(previous => !previous)}><SlidersHorizontal size={16} />{lang === 'uk' ? 'Фільтр' : 'Filter'}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
      </div>

      {filtersOpen && <div className="knowledge-filter-bar">
        <label><span>{lang === 'uk' ? 'Папка' : 'Folder'}</span><select value={notebookFilter} onChange={event => event.target.value === 'all' || event.target.value === 'unlinked' ? openPageCollection(event.target.value) : openNotebook(event.target.value)}><option value="all">{lang === 'uk' ? 'Усі папки' : 'All folders'}</option><option value="unlinked">{lang === 'uk' ? 'Без папки' : 'Without folder'}</option>{notebooks.map(notebook => <option value={notebook.id} key={notebook.id}>{notebook.name}</option>)}</select></label>
        <label><span>{lang === 'uk' ? 'План' : 'Plan'}</span><select value={planFilter} onChange={event => { setPlanFilter(event.target.value); setTaskFilter('all'); }}><option value="all">{lang === 'uk' ? 'Усі плани' : 'All plans'}</option><option value="unlinked">{lang === 'uk' ? 'Без плану' : 'Without plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select></label>
        <label><span>{lang === 'uk' ? 'Завдання' : 'Task'}</span><select value={taskFilter} onChange={event => setTaskFilter(event.target.value)}><option value="all">{lang === 'uk' ? 'Усі завдання' : 'All tasks'}</option><option value="unlinked">{lang === 'uk' ? 'Без завдання' : 'Without task'}</option>{taskFilterOptions.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.planTitle} · {task.title}</option>)}</select></label>
        <button onClick={clearFilters}><X size={15} />{lang === 'uk' ? 'Очистити' : 'Clear'}</button>
      </div>}

      <div className="knowledge-notes-layout knowledge-notebooks-layout">
        <aside className="knowledge-library-sidebar">
          <div className="notebook-sidebar-heading"><span><BookOpen size={16} />{lang === 'uk' ? 'Папки' : 'Folders'}</span><button onClick={createNotebook} aria-label={lang === 'uk' ? 'Створити папку' : 'Create folder'}><FolderPlus size={17} /></button></div>
          <div className="notebook-list">
            <button className={notebookFilter === 'all' ? 'active' : ''} onClick={() => openPageCollection('all')}><FolderOpen size={16} /><span><strong>{lang === 'uk' ? 'Усі сторінки' : 'All pages'}</strong><small>{notes.length}</small></span></button>
            <button className={notebookFilter === 'unlinked' ? 'active' : ''} onClick={() => openPageCollection('unlinked')}><Folder size={16} /><span><strong>{lang === 'uk' ? 'Без папки' : 'Unfiled'}</strong><small>{notes.filter(note => !note.notebookId).length}</small></span></button>
            {notebooks.map(notebook => <div className={`notebook-row ${notebookFilter === notebook.id ? 'active' : ''}`} key={notebook.id}>
              <button className="notebook-row-main" onClick={() => openNotebook(notebook.id)}><i style={{ background: notebook.color }} /><span><strong>{notebook.name}</strong><small>{notes.filter(note => note.notebookId === notebook.id).length} {lang === 'uk' ? 'сторінок' : 'pages'} · {documents.filter(document => document.notebookId === notebook.id).length} {lang === 'uk' ? 'файлів' : 'files'}</small></span></button>
              <button onClick={() => renameNotebook(notebook)} aria-label={lang === 'uk' ? 'Перейменувати' : 'Rename'}><Pencil size={13} /></button>
              <button className="danger" onClick={() => deleteNotebook(notebook)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={13} /></button>
            </div>)}
          </div>
          {activeNotebook && <div className="notebook-link-panel">
            <span><Link2 size={14} />{lang === 'uk' ? 'Прив’язка папки' : 'Folder link'}</span>
            <select value={activeNotebook.planId ?? ''} onChange={event => onUpdateNotebook({ ...activeNotebook, planId: event.target.value || undefined, taskId: undefined })}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select>
            <select value={activeNotebook.taskId ?? ''} disabled={!activeNotebook.planId} onChange={event => onUpdateNotebook({ ...activeNotebook, taskId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без завдання' : 'No task'}</option>{activeNotebookTasks.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.title}</option>)}</select>
          </div>}
          <div className="knowledge-note-list">
            <div className="note-list-heading"><span>{activeNotebook ? (lang === 'uk' ? 'Сторінки папки' : 'Folder pages') : (lang === 'uk' ? 'Сторінки' : 'Pages')}</span><strong>{filteredNotes.length}</strong>{activeNotebook && <button onClick={createNote} aria-label={lang === 'uk' ? 'Нова сторінка в папці' : 'New page in folder'} title={lang === 'uk' ? 'Нова сторінка' : 'New page'}><Plus size={15} /></button>}</div>
            {filteredNotes.map(note => <div className={`note-list-row ${selectedNoteId === note.id ? 'active' : ''}`} key={note.id}>
              <button className="note-list-row-main" onClick={() => selectNote(note)}><strong>{note.title || (lang === 'uk' ? 'Без назви' : 'Untitled')}</strong><small>{notebooks.find(item => item.id === note.notebookId)?.name ?? (lang === 'uk' ? 'Без щоденника' : 'Unfiled')} · {new Date(note.updatedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small></button>
              <button onClick={() => editNote(note)} aria-label={lang === 'uk' ? 'Редагувати нотатку' : 'Edit note'} title={lang === 'uk' ? 'Редагувати' : 'Edit'}><Pencil size={14} /></button>
              <button className="danger" onClick={() => deleteNote(note)} aria-label={lang === 'uk' ? 'Видалити нотатку' : 'Delete note'} title={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={14} /></button>
            </div>)}
            {filteredNotes.length === 0 && <div className="notebook-empty">{lang === 'uk' ? 'Нічого не знайдено' : 'Nothing found'}</div>}
          </div>
        </aside>

        {draft ? <article className="knowledge-editor">
          <header className="note-editor-heading">
            <div className="note-editor-title"><input ref={titleRef} className="knowledge-title-input" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder={lang === 'uk' ? 'Назва нотатки' : 'Note title'} /><small>{lang === 'uk' ? 'Оновлено' : 'Updated'} {new Date(draft.updatedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small></div>
            <div className="note-editor-actions"><button className="btn btn-secondary danger" onClick={() => deleteNote(draft)}><Trash2 size={15} /><span>{lang === 'uk' ? 'Видалити' : 'Delete'}</span></button><button className="btn btn-primary" onClick={() => onSaveNote({ ...draft, updatedAt: new Date().toISOString() })}><Save size={15} /><span>{lang === 'uk' ? 'Зберегти' : 'Save'}</span></button></div>
          </header>

          <details className="note-properties">
            <summary><Link2 size={16} /><span>{lang === 'uk' ? 'Папка, план, завдання й теги' : 'Folder, plan, task & tags'}</span></summary>
            <div className="knowledge-editor-meta knowledge-editor-links">
              <label><span>{lang === 'uk' ? 'Папка' : 'Folder'}</span><select value={draft.notebookId ?? ''} onChange={event => setDraft({ ...draft, notebookId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без папки' : 'No folder'}</option>{notebooks.map(notebook => <option value={notebook.id} key={notebook.id}>{notebook.name}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'План' : 'Plan'}</span><select value={draft.planId ?? ''} onChange={event => setDraft({ ...draft, planId: event.target.value || undefined, taskId: undefined })}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'Завдання' : 'Task'}</span><select value={draft.taskId ?? ''} disabled={!draft.planId} onChange={event => setDraft({ ...draft, taskId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без завдання' : 'No task'}</option>{draftTasks.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.title}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'Теги' : 'Tags'}</span><input value={draft.tags.join(', ')} onChange={event => setDraft({ ...draft, tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder={lang === 'uk' ? 'ідея, важливо' : 'idea, important'} /></label>
            </div>
          </details>

          <div className="note-input-tools">
            <span className="note-tools-label">{lang === 'uk' ? 'Додати до нотатки' : 'Add to note'}</span>
            <button onClick={() => setHandwritingOpen(true)} title={lang === 'uk' ? 'Написати Apple Pencil' : 'Write with Apple Pencil'}><PenLine size={17} /><span>Apple Pencil</span></button>
            <button onClick={() => photoRef.current?.click()} disabled={isUploading} title={lang === 'uk' ? 'Додати фото' : 'Add photo'}><Camera size={17} /><span>{lang === 'uk' ? 'Фото' : 'Photo'}</span></button>
            <button onClick={() => fileRef.current?.click()} disabled={isUploading} title={lang === 'uk' ? 'Додати PDF, Excel або інший файл' : 'Add PDF, Excel, or another file'}><Upload size={17} /><span>{lang === 'uk' ? 'Файл' : 'File'}</span></button>
            <button onClick={() => ocrPhotoRef.current?.click()} disabled={ocrProgress !== null} title={lang === 'uk' ? 'Сфотографувати й розпізнати рукопис' : 'Photograph and recognize handwriting'}><ScanText size={17} /><span>{lang === 'uk' ? 'Сканувати' : 'Scan'}</span></button>
            <button onClick={() => ocrFileRef.current?.click()} disabled={ocrProgress !== null} title={lang === 'uk' ? 'Розпізнати рукопис із фото' : 'Recognize handwriting from photo'}><ScanText size={17} /><span>{lang === 'uk' ? 'Текст із фото' : 'Text from photo'}</span></button>
          </div>
          <input ref={photoRef} hidden type="file" accept="image/*" capture="environment" onChange={event => { void uploadFile(event.target.files?.[0]); event.target.value = ''; }} />
          <input ref={fileRef} hidden type="file" accept={`application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,${EXCEL_FILE_TYPES}`} onChange={event => { void uploadFile(event.target.files?.[0]); event.target.value = ''; }} />
          <input ref={ocrPhotoRef} hidden type="file" accept="image/*" capture="environment" onChange={event => { void scanHandwriting(event.target.files?.[0]); event.target.value = ''; }} />
          <input ref={ocrFileRef} hidden type="file" accept="image/*" onChange={event => { void scanHandwriting(event.target.files?.[0]); event.target.value = ''; }} />
          {ocrProgress !== null && <div className="note-ocr-status"><span>{lang === 'uk' ? `Розпізнаю рукопис… ${ocrProgress}%` : `Recognizing handwriting… ${ocrProgress}%`}</span><progress max="100" value={ocrProgress} /></div>}
          {ocrError && <p className="note-ocr-error">{ocrError}</p>}

          <div className="note-writing-sheet">
            <span>{lang === 'uk' ? 'Текст нотатки' : 'Note text'}</span>
            <textarea lang={lang === 'uk' ? 'uk' : 'en'} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} placeholder={lang === 'uk' ? 'Почніть писати…\n\n• Думка\n• Спостереження\n• Наступний крок' : 'Start writing…'} />
          </div>

          {(attachments.length > 0 || unfiledDocuments.length > 0) && <section className="note-attachments">
            <header><span><Paperclip size={16} />{lang === 'uk' ? 'Вкладення нотатки' : 'Note attachments'}</span><strong>{attachments.length}</strong></header>
            {attachments.map(document => <div className={`note-attachment-row ${isExcelDocument(document) ? 'excel' : ''}`} key={document.id}>{isExcelDocument(document) ? <FileSpreadsheet size={18} /> : <FileText size={18} />}<span><strong>{document.name}</strong><small>{isExcelDocument(document) ? (lang === 'uk' ? 'Excel · редагується в додатку' : 'Excel · editable in app') : ''}{isExcelDocument(document) ? ' · ' : ''}{(document.size / 1024 / 1024).toFixed(1)} MB</small></span><button className={isExcelDocument(document) ? 'excel-edit-button' : ''} onClick={() => isExcelDocument(document) ? setExcelDocument(document) : onOpenDocument(document)} aria-label={lang === 'uk' ? 'Відкрити' : 'Open'} title={isExcelDocument(document) ? (lang === 'uk' ? 'Відкрити й редагувати в додатку' : 'Open and edit in app') : (lang === 'uk' ? 'Відкрити' : 'Open')}>{isExcelDocument(document) ? <><Pencil size={15} /><span>{lang === 'uk' ? 'Редагувати' : 'Edit'}</span></> : <ExternalLink size={16} />}</button><button onClick={() => renameDocument(document)} aria-label={lang === 'uk' ? 'Перейменувати' : 'Rename'} title={lang === 'uk' ? 'Редагувати назву' : 'Edit name'}><Pencil size={16} /></button><button className="danger" onClick={() => onDeleteDocument(document)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'} title={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={16} /></button></div>)}
            {unfiledDocuments.length > 0 && <details><summary>{lang === 'uk' ? `Раніше завантажені файли (${unfiledDocuments.length})` : `Previously uploaded files (${unfiledDocuments.length})`}</summary>{unfiledDocuments.map(document => <div className={`note-attachment-row ${isExcelDocument(document) ? 'excel' : ''}`} key={document.id}>{isExcelDocument(document) ? <FileSpreadsheet size={18} /> : <FileText size={18} />}<span><strong>{document.name}</strong><small>{isExcelDocument(document) ? 'Excel' : (lang === 'uk' ? 'Ще не в нотатці' : 'Not in a note yet')}</small></span><button className={isExcelDocument(document) ? 'excel-edit-button' : ''} onClick={() => isExcelDocument(document) ? setExcelDocument(document) : onOpenDocument(document)}>{isExcelDocument(document) ? <><Pencil size={15} /><span>{lang === 'uk' ? 'Редагувати' : 'Edit'}</span></> : <><ExternalLink size={15} />{lang === 'uk' ? 'Відкрити' : 'Open'}</>}</button><button onClick={() => attachExisting(document)}>{lang === 'uk' ? 'До нотатки' : 'Attach'}</button><button onClick={() => renameDocument(document)} aria-label={lang === 'uk' ? 'Перейменувати' : 'Rename'} title={lang === 'uk' ? 'Редагувати назву' : 'Edit name'}><Pencil size={16} /></button><button className="danger" onClick={() => onDeleteDocument(document)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'} title={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={16} /></button></div>)}</details>}
          </section>}
          {activeNotebook && folderDocuments.length > 0 && <section className="note-attachments folder-files">
            <header><span><FolderOpen size={16} />{lang === 'uk' ? `Інші файли папки «${activeNotebook.name}»` : `Other files in “${activeNotebook.name}”`}</span><strong>{folderDocuments.length}</strong></header>
            {folderDocuments.map(document => <div className={`note-attachment-row ${isExcelDocument(document) ? 'excel' : ''}`} key={document.id}>{isExcelDocument(document) ? <FileSpreadsheet size={18} /> : <FileText size={18} />}<span><strong>{document.name}</strong><small>{notes.find(note => note.id === document.noteId)?.title ?? (lang === 'uk' ? 'Файл папки' : 'Folder file')}</small></span><button className={isExcelDocument(document) ? 'excel-edit-button' : ''} onClick={() => isExcelDocument(document) ? setExcelDocument(document) : onOpenDocument(document)}>{isExcelDocument(document) ? <><Pencil size={15} /><span>{lang === 'uk' ? 'Редагувати' : 'Edit'}</span></> : <><ExternalLink size={15} />{lang === 'uk' ? 'Відкрити' : 'Open'}</>}</button><button onClick={() => attachExisting(document)}>{lang === 'uk' ? 'До сторінки' : 'To page'}</button><button className="danger" onClick={() => onDeleteDocument(document)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={16} /></button></div>)}
          </section>}
        </article> : <div className="simple-empty"><NotebookPen /><strong>{lang === 'uk' ? 'Створіть першу нотатку' : 'Create your first note'}</strong></div>}
      </div>

      {handwritingOpen && draft && <HandwritingInputDialog
        value={draft.content}
        title={lang === 'uk' ? 'Написати нотатку від руки' : 'Handwrite a note'}
        lang={lang}
        recognitionLang={lang}
        multiline
        onApply={content => setDraft({ ...draft, content })}
        onClose={() => setHandwritingOpen(false)}
      />}
      {excelDocument && <ExcelEditorDialog document={excelDocument} lang={lang} onLoad={onLoadDocument} onSave={onSaveExcelDocument} onClose={() => setExcelDocument(null)} />}
    </section>
  );
}
