import { createClient } from '@supabase/supabase-js';
import type { Language, MarketingTemplate, Task } from '../types';
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
  activeTemplateId: string;
  tasksByTemplate: Record<string, Task[]>;
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
    typeof state.activeTemplateId === 'string' &&
    !!state.tasksByTemplate &&
    typeof state.tasksByTemplate === 'object'
  );
};

let cloudUserPromise: Promise<string> | null = null;

const createOrRestoreCloudUser = async (): Promise<string> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (session?.user.id) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Supabase did not return a user');
  return data.user.id;
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
