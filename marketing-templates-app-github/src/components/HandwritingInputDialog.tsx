import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eraser, PenLine, X } from 'lucide-react';
import type { Language } from '../types';

interface HandwritingInputDialogProps {
  value: string;
  title: string;
  lang: Language;
  multiline?: boolean;
  onApply: (value: string) => void;
  onClose: () => void;
}

export default function HandwritingInputDialog({
  value,
  title,
  lang,
  multiline = false,
  onApply,
  onClose,
}: HandwritingInputDialogProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const applyDraft = () => {
    const nextValue = multiline ? draft.trim() : draft.replace(/\s+/g, ' ').trim();
    onApply(nextValue);
    onClose();
  };

  return createPortal(
    <>
      <button
        type="button"
        className="handwriting-backdrop"
        onClick={onClose}
        aria-label={lang === 'uk' ? 'Закрити рукописне введення' : 'Close handwriting input'}
      />
      <section className="handwriting-dialog" role="dialog" aria-modal="true" aria-labelledby="handwriting-title">
        <header className="handwriting-header">
          <span className="handwriting-icon"><PenLine size={21} /></span>
          <div>
            <h2 id="handwriting-title">{title}</h2>
            <p>{lang === 'uk' ? 'Пишіть Apple Pencil у полі нижче — Scribble надрукує розпізнаний текст.' : 'Write with Apple Pencil below — Scribble will type the recognized text.'}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={lang === 'uk' ? 'Закрити' : 'Close'}>
            <X size={18} />
          </button>
        </header>

        <div className="handwriting-pad">
          <textarea
            ref={inputRef}
            lang={lang === 'uk' ? 'uk' : 'en'}
            value={draft}
            rows={multiline ? 8 : 5}
            enterKeyHint={multiline ? 'enter' : 'done'}
            autoCapitalize="sentences"
            autoComplete="off"
            spellCheck
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (!multiline && event.key === 'Enter') {
                event.preventDefault();
                applyDraft();
              }
            }}
            placeholder={lang === 'uk' ? 'Почніть писати тут…' : 'Start writing here…'}
          />
          <span><PenLine size={16} />{lang === 'uk' ? 'Apple Pencil · текст розпізнається на вашому iPad' : 'Apple Pencil · recognition happens on your iPad'}</span>
        </div>

        <footer className="handwriting-actions">
          <button type="button" className="btn btn-secondary handwriting-clear" onClick={() => setDraft('')}>
            <Eraser size={16} />{lang === 'uk' ? 'Очистити' : 'Clear'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{lang === 'uk' ? 'Скасувати' : 'Cancel'}</button>
          <button type="button" className="btn btn-primary" onClick={applyDraft}>{lang === 'uk' ? 'Вставити текст' : 'Insert text'}</button>
        </footer>
      </section>
    </>,
    document.body,
  );
}
