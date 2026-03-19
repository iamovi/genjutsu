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

async function fetchDownloadCount() {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases`);
        const releases = await response.json();

        if (!Array.isArray(releases)) throw new Error('Unexpected API response');

        let totalDownloads = 0;
        releases.forEach(release => {
            release.assets.forEach(asset => {
                totalDownloads += asset.download_count;
            });
        });

        const countElement = document.getElementById('download-count');
        if (countElement) {
            countElement.innerText = totalDownloads.toLocaleString();
        }
    } catch (error) {
        console.error('Error fetching download count:', error);
        const countElement = document.getElementById('download-count');
        if (countElement) countElement.innerText = '100+';
    }
}

document.addEventListener('DOMContentLoaded', fetchDownloadCount);
