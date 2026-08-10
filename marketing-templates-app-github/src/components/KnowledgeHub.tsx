import {
  BookOpen, Camera, ExternalLink, FileText, Folder, FolderOpen,
  FolderPlus, Link2, NotebookPen, Pencil, Plus, Save, Search, SlidersHorizontal,
  Trash2, Upload, X,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Language, WorkspaceDocument, WorkspaceNote, WorkspaceNotebook } from '../types';

interface PlanOption { id: string; title: string }
interface TaskOption { id: string; title: string; planId: string; planTitle: string }

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
  onUpload: (file: File) => void;
  onOpenDocument: (document: WorkspaceDocument) => void;
  onDeleteDocument: (document: WorkspaceDocument) => void;
  onLinkDocument: (documentId: string, planId?: string) => void;
}

type FilterValue = 'all' | 'unlinked' | string;

export default function KnowledgeHub({
  lang, notes, notebooks, documents, plans, tasks, isUploading,
  onCreateNote, onSaveNote, onDeleteNote, onCreateNotebook, onUpdateNotebook,
  onDeleteNotebook, onUpload, onOpenDocument, onDeleteDocument, onLinkDocument,
}: KnowledgeHubProps) {
  const [mode, setMode] = useState<'notes' | 'documents'>('notes');
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id ?? '');
  const [draft, setDraft] = useState<WorkspaceNote | null>(notes[0] ?? null);
  const [notebookFilter, setNotebookFilter] = useState<FilterValue>('all');
  const [planFilter, setPlanFilter] = useState<FilterValue>('all');
  const [taskFilter, setTaskFilter] = useState<FilterValue>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.toLocaleLowerCase().trim());

  const taskFilterOptions = useMemo(
    () => tasks.filter(task => planFilter === 'all' || planFilter === 'unlinked' || task.planId === planFilter),
    [planFilter, tasks],
  );
  const activeNotebook = notebooks.find(notebook => notebook.id === notebookFilter);
  const activeNotebookTasks = activeNotebook?.planId ? tasks.filter(task => task.planId === activeNotebook.planId) : tasks;
  const draftTasks = draft?.planId ? tasks.filter(task => task.planId === draft.planId) : [];

  const filteredNotes = notes.filter(note => {
    const matchesQuery = !deferredQuery || `${note.title} ${note.content} ${note.tags.join(' ')}`.toLocaleLowerCase().includes(deferredQuery);
    const matchesNotebook = notebookFilter === 'all'
      || (notebookFilter === 'unlinked' ? !note.notebookId : note.notebookId === notebookFilter);
    const matchesPlan = planFilter === 'all'
      || (planFilter === 'unlinked' ? !note.planId : note.planId === planFilter);
    const matchesTask = taskFilter === 'all'
      || (taskFilter === 'unlinked' ? !note.taskId : note.taskId === taskFilter);
    return matchesQuery && matchesNotebook && matchesPlan && matchesTask;
  });
  const filteredDocuments = documents.filter(document => `${document.name} ${document.note ?? ''}`.toLocaleLowerCase().includes(deferredQuery));
  const activeFilterCount = Number(notebookFilter !== 'all') + Number(planFilter !== 'all') + Number(taskFilter !== 'all');

  useEffect(() => {
    if (draft || selectedNoteId || notes.length === 0) return;
    setSelectedNoteId(notes[0].id);
    setDraft(notes[0]);
  }, [draft, notes, selectedNoteId]);

  const selectNote = (note: WorkspaceNote) => {
    setSelectedNoteId(note.id);
    setDraft(note);
  };

  const createNote = () => {
    const note = onCreateNote(activeNotebook?.id);
    setSelectedNoteId(note.id);
    setDraft(note);
    setMode('notes');
  };

  const createNotebook = () => {
    const name = prompt(lang === 'uk' ? 'Назва нового щоденника' : 'New journal name')?.trim();
    if (!name) return;
    const notebook = onCreateNotebook(name);
    setNotebookFilter(notebook.id);
    setPlanFilter('all');
    setTaskFilter('all');
  };

  const renameNotebook = (notebook: WorkspaceNotebook) => {
    const name = prompt(lang === 'uk' ? 'Нова назва щоденника' : 'New journal name', notebook.name)?.trim();
    if (name && name !== notebook.name) onUpdateNotebook({ ...notebook, name });
  };

  const deleteNotebook = (notebook: WorkspaceNotebook) => {
    if (!confirm(lang === 'uk' ? `Видалити щоденник «${notebook.name}»? Нотатки залишаться.` : `Delete “${notebook.name}”? Notes will be kept.`)) return;
    onDeleteNotebook(notebook.id);
    if (notebookFilter === notebook.id) setNotebookFilter('all');
  };

  const clearFilters = () => {
    setNotebookFilter('all');
    setPlanFilter('all');
    setTaskFilter('all');
    setQuery('');
  };

  const handleFile = (file?: File) => { if (file) onUpload(file); };

  return (
    <section className="knowledge-hub">
      <header className="simple-page-header">
        <div><span>{lang === 'uk' ? 'Ваш простір знань' : 'Your knowledge space'}</span><h1>{lang === 'uk' ? 'Щоденники, нотатки й документи' : 'Journals, notes & documents'}</h1><p>{lang === 'uk' ? 'Збирайте думки у щоденники та пов’язуйте їх із роботою.' : 'Collect thoughts in journals and connect them to your work.'}</p></div>
        <button className="btn btn-primary" onClick={createNote}><Plus size={16} />{lang === 'uk' ? 'Нова нотатка' : 'New note'}</button>
      </header>

      <div className="knowledge-toolbar">
        <div className="knowledge-tabs">
          <button className={mode === 'notes' ? 'active' : ''} onClick={() => setMode('notes')}><NotebookPen size={16} />{lang === 'uk' ? 'Нотатки' : 'Notes'} <span>{notes.length}</span></button>
          <button className={mode === 'documents' ? 'active' : ''} onClick={() => setMode('documents')}><FileText size={16} />{lang === 'uk' ? 'Документи' : 'Documents'} <span>{documents.length}</span></button>
        </div>
        <label className="knowledge-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'uk' ? 'Знайти нотатку…' : 'Find a note…'} /></label>
        {mode === 'notes' && <button className={`knowledge-filter-toggle ${filtersOpen || activeFilterCount ? 'active' : ''}`} onClick={() => setFiltersOpen(previous => !previous)}><SlidersHorizontal size={16} />{lang === 'uk' ? 'Фільтр' : 'Filter'}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>}
      </div>

      {mode === 'notes' && filtersOpen && (
        <div className="knowledge-filter-bar">
          <label><span>{lang === 'uk' ? 'Щоденник' : 'Journal'}</span><select value={notebookFilter} onChange={event => setNotebookFilter(event.target.value)}><option value="all">{lang === 'uk' ? 'Усі щоденники' : 'All journals'}</option><option value="unlinked">{lang === 'uk' ? 'Без щоденника' : 'Without journal'}</option>{notebooks.map(notebook => <option value={notebook.id} key={notebook.id}>{notebook.name}</option>)}</select></label>
          <label><span>{lang === 'uk' ? 'План' : 'Plan'}</span><select value={planFilter} onChange={event => { setPlanFilter(event.target.value); setTaskFilter('all'); }}><option value="all">{lang === 'uk' ? 'Усі плани' : 'All plans'}</option><option value="unlinked">{lang === 'uk' ? 'Без плану' : 'Without plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select></label>
          <label><span>{lang === 'uk' ? 'Завдання' : 'Task'}</span><select value={taskFilter} onChange={event => setTaskFilter(event.target.value)}><option value="all">{lang === 'uk' ? 'Усі завдання' : 'All tasks'}</option><option value="unlinked">{lang === 'uk' ? 'Без завдання' : 'Without task'}</option>{taskFilterOptions.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.planTitle} · {task.title}</option>)}</select></label>
          <button onClick={clearFilters}><X size={15} />{lang === 'uk' ? 'Очистити' : 'Clear'}</button>
        </div>
      )}

      {mode === 'notes' ? (
        <div className="knowledge-notes-layout knowledge-notebooks-layout">
          <aside className="knowledge-library-sidebar">
            <div className="notebook-sidebar-heading"><span><BookOpen size={16} />{lang === 'uk' ? 'Щоденники' : 'Journals'}</span><button onClick={createNotebook} aria-label={lang === 'uk' ? 'Створити щоденник' : 'Create journal'}><FolderPlus size={17} /></button></div>
            <div className="notebook-list">
              <button className={notebookFilter === 'all' ? 'active' : ''} onClick={() => setNotebookFilter('all')}><FolderOpen size={16} /><span><strong>{lang === 'uk' ? 'Усі нотатки' : 'All notes'}</strong><small>{notes.length}</small></span></button>
              <button className={notebookFilter === 'unlinked' ? 'active' : ''} onClick={() => setNotebookFilter('unlinked')}><Folder size={16} /><span><strong>{lang === 'uk' ? 'Без щоденника' : 'Unfiled'}</strong><small>{notes.filter(note => !note.notebookId).length}</small></span></button>
              {notebooks.map(notebook => (
                <div className={`notebook-row ${notebookFilter === notebook.id ? 'active' : ''}`} key={notebook.id}>
                  <button className="notebook-row-main" onClick={() => setNotebookFilter(notebook.id)}><i style={{ background: notebook.color }} /><span><strong>{notebook.name}</strong><small>{notes.filter(note => note.notebookId === notebook.id).length} {lang === 'uk' ? 'нотаток' : 'notes'}</small></span></button>
                  <button onClick={() => renameNotebook(notebook)} aria-label={lang === 'uk' ? 'Перейменувати' : 'Rename'}><Pencil size={13} /></button>
                  <button className="danger" onClick={() => deleteNotebook(notebook)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>

            {activeNotebook && (
              <div className="notebook-link-panel">
                <span><Link2 size={14} />{lang === 'uk' ? 'Прив’язка щоденника' : 'Journal link'}</span>
                <select value={activeNotebook.planId ?? ''} onChange={event => onUpdateNotebook({ ...activeNotebook, planId: event.target.value || undefined, taskId: undefined })}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select>
                <select value={activeNotebook.taskId ?? ''} disabled={!activeNotebook.planId} onChange={event => onUpdateNotebook({ ...activeNotebook, taskId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без завдання' : 'No task'}</option>{activeNotebookTasks.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.title}</option>)}</select>
              </div>
            )}

            <div className="knowledge-note-list">
              <div className="note-list-heading"><span>{lang === 'uk' ? 'Нотатки' : 'Notes'}</span><strong>{filteredNotes.length}</strong></div>
              {filteredNotes.map(note => {
                const notebook = notebooks.find(item => item.id === note.notebookId);
                return <button className={selectedNoteId === note.id ? 'active' : ''} onClick={() => selectNote(note)} key={note.id}><strong>{note.title || (lang === 'uk' ? 'Без назви' : 'Untitled')}</strong><small>{notebook?.name ?? (lang === 'uk' ? 'Без щоденника' : 'Unfiled')} · {new Date(note.updatedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small></button>;
              })}
              {filteredNotes.length === 0 && <div className="notebook-empty">{lang === 'uk' ? 'Нічого не знайдено' : 'Nothing found'}</div>}
            </div>
          </aside>

          {draft ? <article className="knowledge-editor">
            <input className="knowledge-title-input" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder={lang === 'uk' ? 'Назва нотатки' : 'Note title'} />
            <div className="knowledge-editor-meta knowledge-editor-links">
              <label><span>{lang === 'uk' ? 'Щоденник' : 'Journal'}</span><select value={draft.notebookId ?? ''} onChange={event => setDraft({ ...draft, notebookId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без щоденника' : 'No journal'}</option>{notebooks.map(notebook => <option value={notebook.id} key={notebook.id}>{notebook.name}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'План' : 'Plan'}</span><select value={draft.planId ?? ''} onChange={event => setDraft({ ...draft, planId: event.target.value || undefined, taskId: undefined })}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'Завдання' : 'Task'}</span><select value={draft.taskId ?? ''} disabled={!draft.planId} onChange={event => setDraft({ ...draft, taskId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без завдання' : 'No task'}</option>{draftTasks.map(task => <option value={task.id} key={`${task.planId}-${task.id}`}>{task.title}</option>)}</select></label>
              <label><span>{lang === 'uk' ? 'Теги' : 'Tags'}</span><input value={draft.tags.join(', ')} onChange={event => setDraft({ ...draft, tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder={lang === 'uk' ? 'Наприклад: ідея, важливо' : 'Example: idea, important'} /></label>
            </div>
            <textarea value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} placeholder={lang === 'uk' ? 'Почніть писати…\n\n• Думка\n• Спостереження\n• Наступний крок' : 'Start writing…'} />
            <footer><button className="btn btn-secondary" onClick={() => { if (confirm(lang === 'uk' ? 'Видалити нотатку?' : 'Delete note?')) { onDeleteNote(draft.id); setDraft(null); setSelectedNoteId(''); } }}><Trash2 size={15} />{lang === 'uk' ? 'Видалити' : 'Delete'}</button><button className="btn btn-primary" onClick={() => onSaveNote({ ...draft, updatedAt: new Date().toISOString() })}><Save size={15} />{lang === 'uk' ? 'Зберегти' : 'Save'}</button></footer>
          </article> : <div className="simple-empty"><NotebookPen /><strong>{lang === 'uk' ? 'Створіть першу нотатку' : 'Create your first note'}</strong></div>}
        </div>
      ) : (
        <div className="knowledge-documents">
          <div className="document-upload-actions">
            <button onClick={() => cameraRef.current?.click()} disabled={isUploading}><Camera size={20} /><span><strong>{lang === 'uk' ? 'Сканувати камерою' : 'Scan with camera'}</strong><small>{lang === 'uk' ? 'Сфотографувати документ' : 'Take a document photo'}</small></span></button>
            <button onClick={() => uploadRef.current?.click()} disabled={isUploading}><Upload size={20} /><span><strong>{isUploading ? (lang === 'uk' ? 'Завантаження…' : 'Uploading…') : (lang === 'uk' ? 'Додати PDF або файл' : 'Add PDF or file')}</strong><small>{lang === 'uk' ? 'До 20 МБ, приватне сховище' : 'Up to 20 MB, private storage'}</small></span></button>
            <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
            <input ref={uploadRef} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          <div className="document-grid">{filteredDocuments.map(document => <article key={document.id}><span className={`document-type ${document.mimeType === 'application/pdf' ? 'pdf' : 'image'}`}>{document.mimeType === 'application/pdf' ? <FileText /> : <Camera />}</span><div><strong>{document.name}</strong><small>{(document.size / 1024 / 1024).toFixed(1)} MB · {new Date(document.createdAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small><select value={document.planId ?? ''} onChange={event => onLinkDocument(document.id, event.target.value || undefined)} aria-label={lang === 'uk' ? 'Прив’язати документ до плану' : 'Link document to plan'}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select></div><button onClick={() => onOpenDocument(document)} aria-label={lang === 'uk' ? 'Відкрити' : 'Open'}><ExternalLink size={16} /></button><button className="danger" onClick={() => onDeleteDocument(document)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={16} /></button></article>)}</div>
          {filteredDocuments.length === 0 && <div className="simple-empty"><FileText /><strong>{lang === 'uk' ? 'Документів ще немає' : 'No documents yet'}</strong></div>}
        </div>
      )}
    </section>
  );
}
