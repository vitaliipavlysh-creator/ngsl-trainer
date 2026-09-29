import type { ReactNode } from 'react';
import { LearnPage } from '../features/session/LearnPage';
import { ReviewPage } from '../features/session/ReviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SortPage } from '../features/sort/SortPage';
import { TodayPage } from '../features/today/TodayPage';
import { useApp } from '../store/store';
import { GridIcon, HomeIcon, SettingsIcon } from '../ui/icons';
import { Toaster } from '../ui/Toaster';
import { Link } from './Link';
import { usePath } from './router';
import { useApplyTheme } from './theme';

const NAV = [
  { to: '/', label: 'Сьогодні', Icon: HomeIcon },
  { to: '/sort', label: 'Сортування', Icon: GridIcon },
  { to: '/settings', label: 'Налаштування', Icon: SettingsIcon },
] as const;

function isActive(path: string, to: string) {
  return to === '/' ? path === '/' : path.startsWith(to);
}

function Shell({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-20 hidden border-b border-line bg-bg/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-3">
          <Link to="/" className="font-serif text-lg font-semibold">
            NGSL Trainer
          </Link>
          <nav className="flex gap-1" aria-label="Розділи">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                aria-current={isActive(path, to) ? 'page' : undefined}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg aria-[current=page]:bg-surface-2 aria-[current=page]:text-fg"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-6 pt-[max(env(safe-area-inset-top),1.25rem)] md:pt-8">
        {children}
      </main>

      <nav
        aria-label="Розділи"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-md">
          {NAV.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(path, to) ? 'page' : undefined}
              className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted aria-[current=page]:text-accent"
            >
              <Icon width={22} height={22} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function App({ loadError }: { loadError: Error | null }) {
  const hydrated = useApp((s) => s.hydrated);
  const theme = useApp((s) => s.app.settings.theme);
  useApplyTheme(theme);
  const path = usePath();
  if (!hydrated) return null;

  const banner = loadError && (
    <div role="alert" className="mb-4 rounded-xl border border-queued/50 bg-queued/10 p-3 text-sm">
      Не вдалося прочитати збережений прогрес: {loadError.message}. Зміни зараз не зберігаються, щоб
      не затерти дані.
    </div>
  );

  if (path === '/learn') return <LearnPage />;
  if (path === '/review') return <ReviewPage />;

  const sort = path.match(/^\/sort(?:\/(\d+))?$/);
  let page: ReactNode;
  if (sort) page = <SortPage block={sort[1] ? Number(sort[1]) : null} />;
  else if (path === '/settings') page = <SettingsPage />;
  else page = <TodayPage />;

  return withToaster(
    <Shell path={path}>
      {banner}
      {page}
    </Shell>,
  );
}

function withToaster(node: ReactNode) {
  return (
    <>
      {node}
      <Toaster />
    </>
  );
}
