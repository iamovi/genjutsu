// ─── THEME TOGGLE ───────────────────────────────────────────────────────────
const html = document.documentElement;
const toggleBtn = document.getElementById('themeToggle');

// Restore saved preference on load
const saved = localStorage.getItem('genjutsu-theme');
if (saved === 'light') html.classList.replace('dark', 'light');

toggleBtn.addEventListener('click', () => {
    if (html.classList.contains('dark')) {
        html.classList.replace('dark', 'light');
        localStorage.setItem('genjutsu-theme', 'light');
    } else {
        html.classList.replace('light', 'dark');
        localStorage.setItem('genjutsu-theme', 'dark');
    }
});



