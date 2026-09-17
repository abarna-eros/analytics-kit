import { MoonIcon, SunIcon } from './Icons';
import { useTheme } from '../../theme/ThemeProvider';

export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      className="theme-switch"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
    >
      <span className="theme-switch-thumb" aria-hidden="true" />
      <span className={`theme-switch-icon${isDark ? '' : ' is-active'}`}>
        <SunIcon />
      </span>
      <span className={`theme-switch-icon${isDark ? ' is-active' : ''}`}>
        <MoonIcon />
      </span>
    </button>
  );
}
