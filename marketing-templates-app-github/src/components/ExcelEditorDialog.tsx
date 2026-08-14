import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Plus, Save, X } from 'lucide-react';
import type { Language, WorkspaceDocument } from '../types';

interface ExcelEditorDialogProps {
  document: WorkspaceDocument;
  lang: Language;
  onLoad: (document: WorkspaceDocument) => Promise<ArrayBuffer>;
  onSave: (document: WorkspaceDocument, file: File) => Promise<void>;
  onClose: () => void;
}

type CellValue = string | number | boolean | Date | null;

const displayValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const rich = value as { formula?: string; text?: string; result?: unknown };
    if (rich.formula) return `=${rich.formula}`;
    if (rich.text) return rich.text;
    if (rich.result !== undefined) return String(rich.result);
  }
  return String(value);
};

const parseValue = (value: string): CellValue | { formula: string } => {
  if (value.startsWith('=')) return { formula: value.slice(1) };
  if (value === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const columnLabel = (columnIndex: number) => {
  let label = '';
  let index = columnIndex + 1;
  while (index > 0) {
    index -= 1;
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26);
  }
  return label;
};

export default function ExcelEditorDialog({ document: workspaceDocument, lang, onLoad, onSave, onClose }: ExcelEditorDialogProps) {
  const [workbook, setWorkbook] = useState<import('exceljs').Workbook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [{ Workbook }, buffer] = await Promise.all([import('exceljs'), onLoad(workspaceDocument)]);
        const nextWorkbook = new Workbook();
        await nextWorkbook.xlsx.load(buffer);
        if (!active) return;
        setWorkbook(nextWorkbook);
        setSheetName(nextWorkbook.worksheets[0]?.name ?? '');
      } catch (loadError) {
        console.error('Excel open failed', loadError);
        const reason = loadError instanceof Error ? loadError.message : '';
        if (active) setError(`${lang === 'uk' ? 'Не вдалося прочитати Excel-файл' : 'Could not read this workbook'}${reason ? `: ${reason}` : '.'}`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [workspaceDocument, lang, onLoad, retryRevision]);

  const sheet = workbook?.getWorksheet(sheetName);
  const dimensions = useMemo(() => {
    void revision;
    return {
      rows: Math.max(12, Math.min(250, sheet?.rowCount ?? 12)),
      columns: Math.max(8, Math.min(60, sheet?.columnCount ?? 8)),
    };
  }, [revision, sheet]);

  const save = async () => {
    if (!workbook) return;
    setSaving(true);
    setError('');
    try {
      const bytes = await workbook.xlsx.writeBuffer();
      const fileName = workspaceDocument.name.replace(/\.xls$/i, '.xlsx');
      const file = new File([bytes], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await onSave(workspaceDocument, file);
      onClose();
    } catch (saveError) {
      console.error('Excel save failed', saveError);
      setError(lang === 'uk' ? 'Не вдалося зберегти таблицю.' : 'Could not save the workbook.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="excel-editor-backdrop" role="presentation">
      <section className="excel-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="excel-editor-title">
        <header>
          <div><FileSpreadsheet size={21} /><span><strong id="excel-editor-title">{workspaceDocument.name}</strong><small>{lang === 'uk' ? 'Редактор Excel' : 'Excel editor'}</small></span></div>
          <button onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'}><X size={20} /></button>
        </header>

        {loading && <div className="excel-editor-state">{lang === 'uk' ? 'Відкриваю таблицю…' : 'Opening workbook…'}</div>}
        {error && <div className="excel-editor-state error"><span>{error}</span><button className="btn btn-secondary" onClick={() => { setError(''); setLoading(true); setRetryRevision(value => value + 1); }}>{lang === 'uk' ? 'Спробувати ще раз' : 'Try again'}</button></div>}

        {!loading && workbook && sheet && <>
          <nav className="excel-sheet-tabs">
            {workbook.worksheets.map(item => <button className={item.name === sheetName ? 'active' : ''} onClick={() => setSheetName(item.name)} key={item.id}>{item.name}</button>)}
            <button onClick={() => { const next = workbook.addWorksheet(`${lang === 'uk' ? 'Аркуш' : 'Sheet'} ${workbook.worksheets.length + 1}`); setSheetName(next.name); setRevision(value => value + 1); }} title={lang === 'uk' ? 'Додати аркуш' : 'Add sheet'}><Plus size={16} /></button>
          </nav>
          <div className="excel-grid-scroll">
            <table className="excel-grid">
              <thead><tr><th />{Array.from({ length: dimensions.columns }, (_, column) => <th key={column}>{columnLabel(column)}</th>)}</tr></thead>
              <tbody>{Array.from({ length: dimensions.rows }, (_, rowIndex) => <tr key={rowIndex}><th>{rowIndex + 1}</th>{Array.from({ length: dimensions.columns }, (_, columnIndex) => {
                const cell = sheet.getCell(rowIndex + 1, columnIndex + 1);
                return <td key={`${sheetName}-${columnIndex}`}><input defaultValue={displayValue(cell.value)} onChange={event => { cell.value = parseValue(event.target.value); }} onBlur={() => setRevision(value => value + 1)} aria-label={`${rowIndex + 1}:${columnIndex + 1}`} /></td>;
              })}</tr>)}</tbody>
            </table>
          </div>
          <footer><span>{lang === 'uk' ? 'Зміни збережуться у приватному сховищі нотатки.' : 'Changes will be saved to the note’s private storage.'}</span><button className="btn btn-primary" onClick={() => { void save(); }} disabled={saving}><Save size={16} />{saving ? (lang === 'uk' ? 'Зберігаю…' : 'Saving…') : (lang === 'uk' ? 'Зберегти Excel' : 'Save Excel')}</button></footer>
        </>}
      </section>
    </div>,
    document.body,
  );
}
