export type HandwritingOcrLanguage = 'ukr' | 'eng' | 'ukr+eng';

export async function recognizeHandwriting(
  file: File,
  language: HandwritingOcrLanguage,
  onProgress?: (progress: number) => void,
) {
  const { createWorker } = await import('tesseract.js');
  const languages = language === 'ukr+eng' ? ['ukr', 'eng'] : language;
  const worker = await createWorker(languages, undefined, {
    logger: message => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.(Math.round(message.progress * 100));
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    await worker.terminate();
  }
}
