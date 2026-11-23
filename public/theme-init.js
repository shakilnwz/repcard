(function () {
  var KEY = 'srs:color_mode:v1';
  var VALID = {
    default: '#000000',
    'navy-canvas': '#071a52',
    'black-navy-card': '#000000',
  };
  var mode = 'default';
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) {
      var parsed = raw.charAt(0) === '"' ? JSON.parse(raw) : raw;
      if (parsed && Object.prototype.hasOwnProperty.call(VALID, parsed)) {
        mode = parsed;
      }
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  var root = document.documentElement;
  if (mode === 'default') {
    root.removeAttribute('data-color-mode');
  } else {
    root.setAttribute('data-color-mode', mode);
  }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', VALID[mode]);
  }
})();
