type AudioContextConstructor = typeof AudioContext;

interface AudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
};

const scheduleReminderChime = (context: AudioContext) => {
  const startAt = context.currentTime + 0.025;
  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.025);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.85);
  masterGain.connect(context.destination);

  [659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    const noteStart = startAt + index * 0.18;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    noteGain.gain.setValueAtTime(0.0001, noteStart);
    noteGain.gain.exponentialRampToValueAtTime(1, noteStart + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.48);
    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.5);
  });
};

export const unlockReminderSound = async (playPreview = false) => {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state !== 'running') {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  if (context.state !== 'running') return false;
  if (playPreview) scheduleReminderChime(context);
  return true;
};

export const playReminderSound = async () => {
  const isReady = await unlockReminderSound(false);
  if (!isReady || !audioContext) return false;
  scheduleReminderChime(audioContext);
  return true;
};
