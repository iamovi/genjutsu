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


// ─── DOWNLOAD COUNT ──────────────────────────────────────────────────────────
const REPO = 'iamovi/genjutsu';
const TAG = 'v.1.0.0.0';
const ASSET_NAME = 'genjutsu.apk';

async function fetchDownloadCount() {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`);
        const data = await response.json();
        const asset = data.assets.find(a => a.name === ASSET_NAME);
        const countElement = document.getElementById('download-count');
        if (countElement) {
            countElement.innerText = asset ? asset.download_count.toLocaleString() : '0';
        }
    } catch (error) {
        console.error('Error fetching download count:', error);
        const countElement = document.getElementById('download-count');
        if (countElement) countElement.innerText = '100+';
    }
}

document.addEventListener('DOMContentLoaded', fetchDownloadCount);
