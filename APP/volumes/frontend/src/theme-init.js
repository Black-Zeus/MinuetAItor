(function () {
  try {
    const stored = localStorage.getItem('site-storage') || localStorage.getItem('minuteAItor-base-site');
    if (!stored) {
      document.documentElement.classList.add('dark');
      return;
    }

    const parsed = JSON.parse(stored);
    const state = parsed && typeof parsed === 'object'
      ? (parsed.state && typeof parsed.state === 'object' ? parsed.state : parsed)
      : {};
    const theme = state.theme || 'dark';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_error) {
    document.documentElement.classList.add('dark');
  }
})();
