import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle2, Cloud, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { DEFAULT_TEMPLATES, TEAM_MEMBERS } from '../data/templatesData';
import {
  loadCloudState,
  saveCloudState,
  sendEmailLoginLink,
  signInWithPassword,
  signOutCloudUser,
  supabase,
  type CloudAppState,
} from '../lib/cloudMemory';

const PENDING_WORKSPACE_KEY = 'gantt_pending_account_workspace';

interface AccountContext {
  email: string;
  signOut: () => Promise<void>;
}

interface AuthGateProps {
  children: (account: AccountContext) => ReactNode;
}

const hasPersonalWorkspace = (state: CloudAppState | null) => {
  if (!state) return false;
  if (
    state.customTemplates.length > 0
    || state.hiddenDefaultTemplateIds.length > 0
    || state.archivedPlanIds.length > 0
    || Object.keys(state.planNameOverrides).length > 0
    || JSON.stringify(state.teamMembers) !== JSON.stringify(TEAM_MEMBERS)
  ) return true;

  return DEFAULT_TEMPLATES.some(template => {
    const storedTasks = state.tasksByTemplate[template.id];
    return storedTasks && JSON.stringify(storedTasks) !== JSON.stringify(template.tasks);
  });
};

const readPendingWorkspace = (): CloudAppState | null => {
  try {
    const value = localStorage.getItem(PENDING_WORKSPACE_KEY);
    return value ? JSON.parse(value) as CloudAppState : null;
  } catch {
    return null;
  }
};

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [anonymousState, setAnonymousState] = useState<CloudAppState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const resolveUser = async (nextUser: User | null) => {
      setIsReady(false);
      try {
        if (nextUser?.is_anonymous) {
          const state = await loadCloudState(nextUser.id);
          if (active) setAnonymousState(state);
        } else if (nextUser) {
          const pendingState = readPendingWorkspace();
          if (pendingState) {
            const existingState = await loadCloudState(nextUser.id);
            if (!existingState) await saveCloudState(nextUser.id, pendingState);
            localStorage.removeItem(PENDING_WORKSPACE_KEY);
          }
          if (active) setAnonymousState(null);
        } else if (active) {
          setAnonymousState(null);
        }
        if (active) setUser(nextUser);
      } catch (error) {
        console.error('Account initialization failed', error);
        if (active) setErrorMessage('Не вдалося підготувати кабінет. Оновіть сторінку та спробуйте ще раз.');
      } finally {
        if (active) setIsReady(true);
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return resolveUser(data.session?.user ?? null);
    }).catch(error => {
      console.error('Session restore failed', error);
      if (active) {
        setErrorMessage('Не вдалося перевірити сесію Supabase.');
        setIsReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void resolveUser(session?.user ?? null), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const personalWorkspace = user?.is_anonymous === true && hasPersonalWorkspace(anonymousState);

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsSending(true);
    setErrorMessage('');
    try {
      if (personalWorkspace && anonymousState) {
        localStorage.setItem(PENDING_WORKSPACE_KEY, JSON.stringify(anonymousState));
      }
      if (user) await signOutCloudUser();
      await sendEmailLoginLink(normalizedEmail);
      setSentTo(normalizedEmail);
    } catch (error) {
      console.error('Email login failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'Не вдалося надіслати лист для входу.');
    } finally {
      setIsSending(false);
    }
  };

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setIsSending(true);
    setErrorMessage('');
    try {
      if (user) await signOutCloudUser();
      await signInWithPassword(normalizedEmail, password);
    } catch (error) {
      console.error('Password login failed', error);
      setErrorMessage('Неправильний email або пароль. Перевірте дані та спробуйте ще раз.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isReady) {
    return (
      <main className="auth-screen auth-loading-screen">
        <LoaderCircle className="auth-spinner" size={30} />
        <strong>Підключаємо захищений кабінет…</strong>
      </main>
    );
  }

  if (user && !user.is_anonymous) {
    return children({ email: user.email ?? '', signOut: signOutCloudUser });
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><Cloud size={22} /><span>Marketing Workspace</span></div>
        {sentTo ? (
          <div className="auth-confirmation">
            <span className="auth-success-icon"><CheckCircle2 size={28} /></span>
            <p className="auth-eyebrow">Лист надіслано</p>
            <h1>Перевірте вашу пошту</h1>
            <p>Ми надіслали безпечне посилання для входу на <strong>{sentTo}</strong>. Відкрийте його на цьому пристрої.</p>
            {personalWorkspace && <div className="auth-migration-note"><ShieldCheck size={17} />Після входу ваші поточні плани буде перенесено в кабінет.</div>}
            <button className="auth-secondary-button" onClick={() => setSentTo('')}>Вказати інший email</button>
          </div>
        ) : (
          <>
            <p className="auth-eyebrow">Особистий кабінет</p>
            <h1>{personalWorkspace ? 'Збережіть свої плани' : 'Увійдіть у планувальник'}</h1>
            <p className="auth-description">
              {personalWorkspace
                ? `Знайдено ваш поточний робочий простір із ${anonymousState?.customTemplates.length ?? 0} власними планами. Прив’яжемо його до вашого email.`
                : 'Введіть email — і ми відкриємо ваш особистий простір. Новий email отримає чистий планувальник.'}
            </p>
            <form className="auth-form" onSubmit={usePassword ? handlePasswordLogin : handleEmailLogin}>
              <label htmlFor="account-email">Ваш email</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              {usePassword && (
                <>
                  <label htmlFor="account-password">Пароль</label>
                  <div className="auth-input-wrap">
                    <KeyRound size={18} />
                    <input
                      id="account-password"
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Введіть пароль"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </>
              )}
              {errorMessage && <div className="auth-error">{errorMessage}</div>}
              <button className="auth-submit" disabled={isSending}>
                {isSending ? <LoaderCircle className="auth-spinner" size={18} /> : <LockKeyhole size={18} />}
                {usePassword ? 'Увійти зараз' : personalWorkspace ? 'Зберегти й увійти' : 'Увійти через email'}
                {!isSending && <ArrowRight size={18} />}
              </button>
              <button
                type="button"
                className="auth-secondary-button"
                onClick={() => {
                  setUsePassword(current => !current);
                  setErrorMessage('');
                }}
              >
                {usePassword ? 'Увійти через лист' : 'Увійти з паролем'}
              </button>
            </form>
            <div className="auth-security-note"><ShieldCheck size={16} /><span>Кожен email бачить лише власні плани, задачі, підзадачі та виконавців.</span></div>
          </>
        )}
      </section>
    </main>
  );
}
