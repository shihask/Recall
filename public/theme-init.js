;(function () {
  try {
    var pref = localStorage.getItem('recall.theme') || 'system'
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  } catch (e) {
    /* storage blocked: fall back to light; ThemeProvider re-evaluates on mount */
  }
})()
