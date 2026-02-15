import { storage } from '../services/storage.js';

export function renderSettingsScreen() {
    const root = document.getElementById('results');
    const stats = storage.getUserStats?.() || { totalReports: 0, helpedAnglers: 0 };
    root.innerHTML = `
      <main class="fishcast-shell screen-view">
        <section class="card detail-header">
          <button class="back-btn" id="settingsBack">Back</button>
          <h1 class="detail-title">Settings</h1>
        </section>
        <section class="card detail-grid">
          <h2 class="card-header">Appearance</h2>
          <label class="setting-row"><span>Dark Mode</span><input id="darkModeToggle" type="checkbox" ${storage.getTheme() === 'dark' ? 'checked' : ''}></label>
        </section>
        <section class="card detail-grid">
          <h2 class="card-header">Stats</h2>
          <p>Water Temp Reports: ${stats.totalReports || 0}</p>
          <p>Anglers Helped: ${stats.helpedAnglers || 0}</p>
        </section>
      </main>`;

    document.getElementById('settingsBack')?.addEventListener('click', () => { window.location.hash = '#/'; });
    document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        storage.setTheme(theme);
    });
}

export function renderAboutScreen() {
    document.getElementById('results').innerHTML = `
      <main class="fishcast-shell screen-view">
        <section class="card detail-header">
          <button class="back-btn" id="aboutBack">Back</button>
          <h1 class="detail-title">About</h1>
        </section>
        <section class="card detail-grid">
          <p><strong>FishCast</strong> is a science-based fishing forecast by The Southern Bluegill Association.</p>
          <p>It combines weather, pressure, water temperature modeling, and species-aware scoring to provide data-first daily guidance.</p>
        </section>
      </main>`;
    document.getElementById('aboutBack')?.addEventListener('click', () => { window.location.hash = '#/'; });
}
