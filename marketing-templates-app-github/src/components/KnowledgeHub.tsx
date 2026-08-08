import { Camera, ExternalLink, FileText, NotebookPen, Plus, Save, Search, Trash2, Upload } from 'lucide-react';
import { useDeferredValue, useRef, useState } from 'react';
import type { Language, WorkspaceDocument, WorkspaceNote } from '../types';

interface PlanOption { id: string; title: string }

interface KnowledgeHubProps {
  lang: Language;
  notes: WorkspaceNote[];
  documents: WorkspaceDocument[];
  plans: PlanOption[];
  isUploading: boolean;
  onCreateNote: () => WorkspaceNote;
  onSaveNote: (note: WorkspaceNote) => void;
  onDeleteNote: (noteId: string) => void;
  onUpload: (file: File) => void;
  onOpenDocument: (document: WorkspaceDocument) => void;
  onDeleteDocument: (document: WorkspaceDocument) => void;
}

export default function KnowledgeHub({ lang, notes, documents, plans, isUploading, onCreateNote, onSaveNote, onDeleteNote, onUpload, onOpenDocument, onDeleteDocument }: KnowledgeHubProps) {
  const [mode, setMode] = useState<'notes' | 'documents'>('notes');
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id ?? '');
  const [draft, setDraft] = useState<WorkspaceNote | null>(notes[0] ?? null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.toLocaleLowerCase());
  const filteredNotes = notes.filter(note => `${note.title} ${note.content} ${note.tags.join(' ')}`.toLocaleLowerCase().includes(deferredQuery));
  const filteredDocuments = documents.filter(document => `${document.name} ${document.note ?? ''}`.toLocaleLowerCase().includes(deferredQuery));
  const selectNote = (note: WorkspaceNote) => { setSelectedNoteId(note.id); setDraft(note); };
  const createNote = () => { const note = onCreateNote(); setSelectedNoteId(note.id); setDraft(note); setMode('notes'); };
  const handleFile = (file?: File) => { if (file) onUpload(file); };

  return (
    <section className="knowledge-hub">
      <header className="simple-page-header"><div><span>{lang === 'uk' ? 'Ваш простір знань' : 'Your knowledge space'}</span><h1>{lang === 'uk' ? 'Нотатки й документи' : 'Notes & documents'}</h1><p>{lang === 'uk' ? 'Як у Notion: записуйте думки, зберігайте PDF та скани.' : 'Like Notion: write ideas, save PDFs and scans.'}</p></div><button className="btn btn-primary" onClick={createNote}><Plus size={16} />{lang === 'uk' ? 'Нова сторінка' : 'New page'}</button></header>
      <div className="knowledge-toolbar">
        <div className="knowledge-tabs"><button className={mode === 'notes' ? 'active' : ''} onClick={() => setMode('notes')}><NotebookPen size={16} />{lang === 'uk' ? 'Сторінки' : 'Pages'} <span>{notes.length}</span></button><button className={mode === 'documents' ? 'active' : ''} onClick={() => setMode('documents')}><FileText size={16} />{lang === 'uk' ? 'Документи' : 'Documents'} <span>{documents.length}</span></button></div>
        <label className="knowledge-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={lang === 'uk' ? 'Пошук…' : 'Search…'} /></label>
      </div>

      {mode === 'notes' ? (
        <div className="knowledge-notes-layout">
          <aside className="knowledge-note-list">{filteredNotes.map(note => <button className={selectedNoteId === note.id ? 'active' : ''} onClick={() => selectNote(note)} key={note.id}><strong>{note.title || (lang === 'uk' ? 'Без назви' : 'Untitled')}</strong><small>{new Date(note.updatedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small></button>)}</aside>
          {draft ? <article className="knowledge-editor">
            <input className="knowledge-title-input" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder={lang === 'uk' ? 'Назва сторінки' : 'Page title'} />
            <div className="knowledge-editor-meta"><select value={draft.planId ?? ''} onChange={event => setDraft({ ...draft, planId: event.target.value || undefined })}><option value="">{lang === 'uk' ? 'Без плану' : 'No plan'}</option>{plans.map(plan => <option value={plan.id} key={plan.id}>{plan.title}</option>)}</select><input value={draft.tags.join(', ')} onChange={event => setDraft({ ...draft, tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder={lang === 'uk' ? 'Теги через кому' : 'Comma-separated tags'} /></div>
            <textarea value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} placeholder={lang === 'uk' ? 'Почніть писати…\n\n• Ідея\n• Чекліст\n• Важливі посилання' : 'Start writing…'} />
            <footer><button className="btn btn-secondary" onClick={() => { if (confirm(lang === 'uk' ? 'Видалити сторінку?' : 'Delete page?')) { onDeleteNote(draft.id); setDraft(null); setSelectedNoteId(''); } }}><Trash2 size={15} />{lang === 'uk' ? 'Видалити' : 'Delete'}</button><button className="btn btn-primary" onClick={() => onSaveNote({ ...draft, updatedAt: new Date().toISOString() })}><Save size={15} />{lang === 'uk' ? 'Зберегти' : 'Save'}</button></footer>
          </article> : <div className="simple-empty"><NotebookPen /><strong>{lang === 'uk' ? 'Створіть першу сторінку' : 'Create your first page'}</strong></div>}
        </div>
      ) : (
        <div className="knowledge-documents">
          <div className="document-upload-actions">
            <button onClick={() => cameraRef.current?.click()} disabled={isUploading}><Camera size={20} /><span><strong>{lang === 'uk' ? 'Сканувати камерою' : 'Scan with camera'}</strong><small>{lang === 'uk' ? 'Сфотографувати документ' : 'Take a document photo'}</small></span></button>
            <button onClick={() => uploadRef.current?.click()} disabled={isUploading}><Upload size={20} /><span><strong>{isUploading ? (lang === 'uk' ? 'Завантаження…' : 'Uploading…') : (lang === 'uk' ? 'Додати PDF або файл' : 'Add PDF or file')}</strong><small>{lang === 'uk' ? 'До 20 МБ, приватне сховище' : 'Up to 20 MB, private storage'}</small></span></button>
            <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
            <input ref={uploadRef} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          <div className="document-grid">{filteredDocuments.map(document => <article key={document.id}><span className={`document-type ${document.mimeType === 'application/pdf' ? 'pdf' : 'image'}`}>{document.mimeType === 'application/pdf' ? <FileText /> : <Camera />}</span><div><strong>{document.name}</strong><small>{(document.size / 1024 / 1024).toFixed(1)} MB · {new Date(document.createdAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}</small></div><button onClick={() => onOpenDocument(document)} aria-label={lang === 'uk' ? 'Відкрити' : 'Open'}><ExternalLink size={16} /></button><button className="danger" onClick={() => onDeleteDocument(document)} aria-label={lang === 'uk' ? 'Видалити' : 'Delete'}><Trash2 size={16} /></button></article>)}</div>
          {filteredDocuments.length === 0 && <div className="simple-empty"><FileText /><strong>{lang === 'uk' ? 'Документів ще немає' : 'No documents yet'}</strong></div>}
        </div>
      )}
    </section>
  );
}
