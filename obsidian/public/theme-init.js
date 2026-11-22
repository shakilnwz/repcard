(function () {
  try {
    var raw = localStorage.getItem('genforge-kb-ui-v1');
    var mode = 'dark';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.theme) {
        mode = parsed.state.theme;
      }
    }
    var resolved = mode;
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.dataset.theme = resolved;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? '#0B132B' : '#F3F6FC');
    }
  } catch (_) {}
})();
