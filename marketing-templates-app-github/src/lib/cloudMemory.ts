import { createClient } from '@supabase/supabase-js';
import type { Idea, Language, MarketingTemplate, Reminder, Task, TeamMember, WorkspaceDocument, WorkspaceNote, WorkspaceNotebook } from '../types';
import type { Database, Json } from './database.types';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://xyvpresvfubmmfweyasf.supabase.co';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4J-yHzPGBf1udf_UR8DS1w_j3mQo_WU';

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type CloudSyncStatus = 'connecting' | 'saving' | 'synced' | 'error';

export interface CloudAppState {
  version: 1;
  theme: 'light' | 'dark';
  lang: Language;
  showOnboarding: boolean;
  customTemplates: MarketingTemplate[];
  hiddenDefaultTemplateIds: string[];
  teamMembers: TeamMember[];
  planNameOverrides: Record<string, string>;
  archivedPlanIds: string[];
  activeTemplateId: string;
  tasksByTemplate: Record<string, Task[]>;
  reminders?: Reminder[];
  ideas?: Idea[];
  notes?: WorkspaceNote[];
  notebooks?: WorkspaceNotebook[];
  documents?: WorkspaceDocument[];
}

export const isCloudAppState = (value: unknown): value is CloudAppState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<CloudAppState>;
  return (
    state.version === 1 &&
    (state.theme === 'light' || state.theme === 'dark') &&
    (state.lang === 'uk' || state.lang === 'en') &&
    typeof state.showOnboarding === 'boolean' &&
    Array.isArray(state.customTemplates) &&
    (state.hiddenDefaultTemplateIds === undefined ||
      (Array.isArray(state.hiddenDefaultTemplateIds) &&
        state.hiddenDefaultTemplateIds.every(id => typeof id === 'string'))) &&
    (state.teamMembers === undefined ||
      (Array.isArray(state.teamMembers) && state.teamMembers.every(member =>
        !!member &&
        typeof member.name === 'string' &&
        typeof member.roleUa === 'string' &&
        typeof member.roleEn === 'string' &&
        typeof member.avatarColor === 'string'
      ))) &&
    (state.planNameOverrides === undefined ||
      (!!state.planNameOverrides &&
        typeof state.planNameOverrides === 'object' &&
        Object.values(state.planNameOverrides).every(name => typeof name === 'string'))) &&
    (state.archivedPlanIds === undefined ||
      (Array.isArray(state.archivedPlanIds) &&
        state.archivedPlanIds.every(id => typeof id === 'string'))) &&
    typeof state.activeTemplateId === 'string' &&
    !!state.tasksByTemplate &&
    typeof state.tasksByTemplate === 'object' &&
    (state.reminders === undefined || Array.isArray(state.reminders)) &&
    (state.ideas === undefined || Array.isArray(state.ideas)) &&
    (state.notes === undefined || Array.isArray(state.notes)) &&
    (state.notebooks === undefined || Array.isArray(state.notebooks)) &&
    (state.documents === undefined || Array.isArray(state.documents))
  );
};

let cloudUserPromise: Promise<string> | null = null;

const createOrRestoreCloudUser = async (): Promise<string> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user.id || session.user.is_anonymous) {
    throw new Error('A permanent account is required for cloud memory');
  }
  return session.user.id;
};

export const ensureCloudUser = (): Promise<string> => {
  if (!cloudUserPromise) {
    cloudUserPromise = createOrRestoreCloudUser().catch((error) => {
      cloudUserPromise = null;
      throw error;
    });
  }
  return cloudUserPromise;
};

export const sendEmailLoginLink = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
};

export const signInWithPassword = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signUpWithPassword = async (email: string, password: string): Promise<boolean> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return !data.session;
};

export const signOutCloudUser = async (): Promise<void> => {
  cloudUserPromise = null;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const loadCloudState = async (userId: string): Promise<CloudAppState | null> => {
  const { data, error } = await supabase
    .from('app_states')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return isCloudAppState(data?.state) ? data.state : null;
};

export const saveCloudState = async (
  userId: string,
  state: CloudAppState,
): Promise<void> => {
  const { error } = await supabase.from('app_states').upsert(
    {
      user_id: userId,
      state: state as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
};

const DOCUMENT_BUCKET = 'workspace-documents';

const getDocumentContentType = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  return file.type || 'application/octet-stream';
};

export const uploadWorkspaceDocument = async (userId: string, file: File): Promise<string> => {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  const safeBaseName = file.name
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'document';
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}-${safeBaseName}${extension}`;
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    contentType: getDocumentContentType(file),
    upsert: false,
  });
  if (error) throw error;
  return path;
};

export const downloadWorkspaceDocument = async (path: string): Promise<ArrayBuffer> => {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(path);
  if (error) throw error;
  return data.arrayBuffer();
};

export const openWorkspaceDocument = async (path: string): Promise<void> => {
  const previewWindow = window.open('about:blank', '_blank');
  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.title = 'Loading document…';
    previewWindow.document.body.textContent = 'Loading document…';
  }
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) {
    previewWindow?.close();
    throw error;
  }
  if (previewWindow) previewWindow.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
};

export const deleteWorkspaceDocument = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
  if (error) throw error;
};
