import { MonitorIcon, MoonIcon, SunIcon } from './Icons';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemePreference } from '../../data/site';

const OPTIONS: { id: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
  { id: 'system', label: 'System', icon: MonitorIcon },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Color theme" style={{ display: 'flex', gap: 4 }}>
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={preference === id}
          aria-label={label}
          className="btn-icon"
          title={label}
          onClick={() => setPreference(id)}
          style={{
            borderColor: preference === id ? 'var(--accent)' : undefined,
            color: preference === id ? 'var(--accent)' : undefined,
          }}
        >
          <Icon />
          {compact ? null : <span className="sr-only">{label}</span>}
        </button>
      ))}
    </div>
  );
}
