import { cToF, kmhToMph, getWindDirection } from '../utils/math.js';
import { calculateFishingScore, getPressureRate } from '../models/fishingScore.js';
import { calculateSolunar } from '../models/solunar.js';
import { calculateSpeciesAwareDayScore } from '../models/forecastEngine.js';
import { estimateTempByDepth } from '../models/waterTemp.js';

let latestForecastData = null;
let savedMainScroll = 0;

function parseHashRoute() {
    const hash = window.location.hash || '#/';
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const [path, query = ''] = raw.split('?');
    const normalizedPath = path || '/';
    return { path: normalizedPath, params: new URLSearchParams(query) };
}

function setHashRoute(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const next = `#${path}${query ? `?${query}` : ''}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
}

function normalizeState(score) {
    if (score >= 80) return { label: 'Good', className: 'state-good' };
    if (score >= 60) return { label: 'Fair', className: 'state-fair' };
    return { label: 'Poor', className: 'state-poor' };
}

function weatherCodeToIcon(code, isDay = true, size = 30) {
    const val = Number(code) || 0;
    const night = !isDay;
    let key = 'cloudy';
    if (val === 0) key = night ? 'clear-night' : 'clear-day';
    else if ([1, 2].includes(val)) key = 'partly-cloudy';
    else if (val === 3) key = 'cloudy';
    else if ([45, 48].includes(val)) key = 'fog';
    else if (val >= 51 && val <= 67) key = 'drizzle';
    else if (val >= 80 && val <= 82) key = 'rain';
    else if (val >= 83 && val <= 84) key = 'heavy-rain';
    else if (val >= 71 && val <= 77) key = 'snow';
    else if (val >= 95) key = 'thunder';

    const icons = {
        'clear-day': '<circle cx="12" cy="12" r="5"/><g stroke-width="1.5"><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.9 4.9l2.2 2.2"/><path d="M16.9 16.9l2.2 2.2"/><path d="M19.1 4.9l-2.2 2.2"/><path d="M7.1 16.9l-2.2 2.2"/></g>',
        'clear-night': '<path d="M15.5 3.5a8 8 0 1 0 5 14.2A9 9 0 0 1 15.5 3.5z"/>',
        'partly-cloudy': '<path d="M7.5 16.5h10a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 7.5 16.5z"/><circle cx="8" cy="8" r="3"/>',
        cloudy: '<path d="M6.5 17h11a3.5 3.5 0 0 0 .4-7 5.2 5.2 0 0 0-9.8-1.6A4 4 0 0 0 6.5 17z"/>',
        fog: '<path d="M6.5 11.5h11a3.2 3.2 0 1 0-.7-6.4A4.8 4.8 0 0 0 7.8 6.8 3.6 3.6 0 0 0 6.5 11.5z"/><path d="M5 15h14M7 18h10"/>',
        drizzle: '<path d="M6.5 12.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 6.5 12.5z"/><path d="M9 16l-1 2M13 16l-1 2M17 16l-1 2"/>',
        rain: '<path d="M6.5 12.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 6.5 12.5z"/><path d="M9 16l-1.2 3M13 16l-1.2 3M17 16l-1.2 3"/>',
        'heavy-rain': '<path d="M6.5 12.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 6.5 12.5z"/><path d="M8.5 15l-1.3 4M12 15l-1.3 4M15.5 15l-1.3 4M19 15l-1.3 4"/>',
        thunder: '<path d="M6.5 12.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 6.5 12.5z"/><path d="M12 13l-2 4h2l-1 4 4-6h-2l1-2z"/>',
        snow: '<path d="M6.5 12.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9.1-1.8A3.8 3.8 0 0 0 6.5 12.5z"/><path d="M9 17h.1M13 17h.1M17 17h.1"/>'
    };

    return `<svg class="weather-icon" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${key.replace('-', ' ')}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${icons[key]}</svg>`;
}

function getWeatherLabel(code) {
    const weatherCode = Number(code) || 0;
    if (weatherCode === 0) return 'Clear';
    if ([1, 2].includes(weatherCode)) return 'Partly cloudy';
    if (weatherCode === 3) return 'Cloudy';
    if ([45, 48].includes(weatherCode)) return 'Fog';
    if (weatherCode >= 51 && weatherCode <= 67) return 'Drizzle';
    if (weatherCode >= 71 && weatherCode <= 77) return 'Snow';
    if (weatherCode >= 80 && weatherCode <= 84) return 'Rain';
    if (weatherCode >= 95) return 'Thunderstorm';
    return 'Mixed';
}

function getBestWindowText(score, windMph, precipProb) {
    if (score >= 82) return 'Morning to late morning should be most productive.';
    if (score >= 74) return 'Conditions stay stable through most of the day.';
    if (precipProb > 55) return 'Early hours are strongest before heavier rain risk.';
    if (windMph > 14) return 'Protected shorelines and structure should fish better.';
    return 'Morning presents the best consistency.';
}

function getDayScore(data, dayIndex, moonPhasePercent) {
    const { weather, waterTemp, speciesKey } = data;
    const daily = weather.forecast.daily;
    const dayKey = daily.time[dayIndex];
    const locationKey = `${data.coords.lat.toFixed(3)}_${data.coords.lon.toFixed(3)}`;

    const modern = calculateSpeciesAwareDayScore({ data, dayKey, speciesKey, waterTempF: waterTemp, locationKey, now: new Date(), debug: false });
    if (Number.isFinite(modern?.score)) return modern.score;

    const weatherSlice = {
        current: {
            surface_pressure: daily.surface_pressure_mean?.[dayIndex] ?? weather.forecast.current.surface_pressure,
            wind_speed_10m: daily.wind_speed_10m_max?.[dayIndex] ?? weather.forecast.current.wind_speed_10m,
            cloud_cover: daily.cloud_cover_mean?.[dayIndex] ?? weather.forecast.current.cloud_cover,
            weather_code: daily.weather_code?.[dayIndex] ?? weather.forecast.current.weather_code
        },
        hourly: {
            surface_pressure: [daily.surface_pressure_mean?.[dayIndex] ?? weather.forecast.current.surface_pressure],
            precipitation_probability: [daily.precipitation_probability_max?.[dayIndex] ?? 0]
        },
        daily: {
            precipitation_sum: (weather.historical?.daily?.precipitation_sum || []).concat((daily.precipitation_sum || []).slice(0, dayIndex + 1)).slice(-3)
        }
    };

    return calculateFishingScore(weatherSlice, waterTemp, speciesKey, moonPhasePercent).score;
}

function buildDailyRows(data) {
    const daily = data.weather.forecast.daily;
    const solunar = calculateSolunar(data.coords.lat, data.coords.lon, new Date());
    return daily.time.slice(0, 5).map((date, index) => {
        const score = getDayScore(data, index, solunar.moon_phase_percent);
        return {
            date,
            dayLabel: index === 0 ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
            icon: weatherCodeToIcon(daily.weather_code?.[index], true, 22),
            weatherLabel: getWeatherLabel(daily.weather_code?.[index]),
            lowTempF: cToF(daily.temperature_2m_min?.[index] || 0).toFixed(0),
            highTempF: cToF(daily.temperature_2m_max?.[index] || 0).toFixed(0),
            score,
            state: normalizeState(score)
        };
    });
}

function renderMiniScaleBar(value, max = 30) {
    const ratio = Math.max(0, Math.min(1, value / max));
    return `<div class="mini-scale" role="img" aria-label="Wind scale calm to strong"><span>Calm</span><div class="mini-scale-track"><i style="left:${(ratio * 100).toFixed(1)}%"></i></div><span>Strong</span></div>`;
}

function renderPressureSparkline(values) {
    const safe = values.filter(Number.isFinite);
    if (!safe.length) return '<p class="metric-note">No pressure trend available.</p>';
    const min = Math.min(...safe);
    const max = Math.max(...safe);
    const range = max - min || 1;
    const points = safe.map((v, i) => `${(i / Math.max(1, safe.length - 1) * 100).toFixed(1)},${(30 - ((v - min) / range) * 30).toFixed(1)}`).join(' ');
    const lastX = 100;
    const lastY = 30 - ((safe[safe.length - 1] - min) / range) * 30;
    return `<svg class="pressure-sparkline" viewBox="0 0 100 30" role="img" aria-label="Pressure trend last 24 hours"><polyline points="${points}"/><circle cx="${lastX}" cy="${lastY.toFixed(1)}" r="1.8"/></svg>`;
}

function renderMiniTrendChart(chartId, points, unit, decimals = 0) {
    const safe = points.filter((p) => Number.isFinite(p.v));
    if (!safe.length) return '<p class="trend-empty">No data.</p>';
    const min = Math.min(...safe.map((p) => p.v));
    const max = Math.max(...safe.map((p) => p.v));
    const range = max - min || 1;
    const path = safe.map((p, i) => `${(i / Math.max(1, safe.length - 1) * 100).toFixed(2)},${(38 - ((p.v - min) / range) * 38).toFixed(2)}`).join(' ');
    return `
    <div class="mini-trend" data-chart-id="${chartId}" data-unit="${unit}" data-decimals="${decimals}">
      <div class="trend-axis-y"><span>${max.toFixed(decimals)}${unit}</span><span>${min.toFixed(decimals)}${unit}</span></div>
      <div class="trend-plot">
        <svg viewBox="0 0 100 38" class="mini-trend-svg" aria-label="24 hour trend chart"><line x1="0" y1="19" x2="100" y2="19" class="trend-guide"/><polyline points="${path}"/></svg>
        <div class="trend-axis-x"><span>Now</span><span>24h</span></div>
        <div class="trend-tooltip" hidden></div>
      </div>
    </div>`;
}

function attachTrendTooltips(container, trendSeriesMap) {
    container.querySelectorAll('.mini-trend').forEach((chart) => {
        const id = chart.dataset.chartId;
        const series = trendSeriesMap[id] || [];
        const tooltip = chart.querySelector('.trend-tooltip');
        const svg = chart.querySelector('.mini-trend-svg');
        if (!svg || !tooltip || !series.length) return;

        const setTooltip = (clientX) => {
            const rect = svg.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const idx = Math.min(series.length - 1, Math.round(ratio * (series.length - 1)));
            const point = series[idx];
            tooltip.hidden = false;
            tooltip.style.left = `${ratio * 100}%`;
            tooltip.textContent = `${point.t} · ${point.v.toFixed(Number(chart.dataset.decimals || 0))}${chart.dataset.unit}`;
        };

        svg.addEventListener('pointermove', (e) => setTooltip(e.clientX));
        svg.addEventListener('pointerdown', (e) => setTooltip(e.clientX));
        svg.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    });
}

function renderMainView(data) {
    const { coords, weather } = data;
    const resultsDiv = document.getElementById('results');
    const solunar = calculateSolunar(coords.lat, coords.lon, new Date());
    const score = getDayScore(data, 0, solunar.moon_phase_percent);
    const state = normalizeState(score);

    const windMph = kmhToMph(weather.forecast.current.wind_speed_10m);
    const windGust = kmhToMph(weather.forecast.current.wind_gusts_10m || weather.forecast.current.wind_speed_10m);
    const windDir = getWindDirection(weather.forecast.current.wind_direction_10m);
    const pressureSeries = weather.forecast.hourly.surface_pressure.slice(0, 24).map((p) => p * 0.02953);
    const pressureCurrent = pressureSeries[0]?.toFixed(2) || 'N/A';
    const pressureTrend = getPressureRate(weather.forecast.hourly.surface_pressure.slice(0, 6)).trend;
    const dailyRows = buildDailyRows(data);
    const icon = weatherCodeToIcon(weather.forecast.current.weather_code, weather.forecast.current.is_day === 1, 38);

    resultsDiv.innerHTML = `
      <main class="fishcast-shell" aria-label="Fishing conditions overview">
        <section class="card hero-card">
          <p class="hero-location">${coords.name}</p>
          <div class="hero-condition-row">${icon}<div><h1 class="hero-title">Fishing Conditions</h1><p class="hero-condition-label">${getWeatherLabel(weather.forecast.current.weather_code)}</p></div></div>
          <p class="hero-index">${score}</p>
          <p class="pill ${state.className}">${state.label}</p>
        </section>

        <section class="card daily-card">
          <div class="card-header-row"><h2 class="card-header">Daily Forecast</h2><button class="route-btn" data-route="/map">Radar</button></div>
          <ul class="daily-list">
            ${dailyRows.map((row) => `
              <li><button type="button" class="daily-row" data-day="${row.date}"><span class="daily-day">${row.dayLabel}</span><span class="daily-condition">${row.icon}<span>${row.weatherLabel}</span></span><span class="daily-score ${row.state.className}">${row.score}</span><span class="daily-temp-low">${row.lowTempF}°</span><span class="daily-temp-high">${row.highTempF}°</span></button></li>
            `).join('')}
          </ul>
        </section>

        <section class="metrics-grid">
          <article class="card metric-card"><h3>Wind</h3><p class="metric-value">${windMph.toFixed(0)} mph</p><p class="metric-note">Gusts: ${windGust.toFixed(0)} mph · ${windDir}</p>${renderMiniScaleBar(windMph)}</article>
          <article class="card metric-card"><h3>Pressure</h3><p class="metric-value">${pressureCurrent} inHg</p><p class="metric-note">${pressureTrend === 'rising' || pressureTrend === 'rapid_rise' ? 'Rising' : pressureTrend === 'steady' ? 'Steady' : 'Falling'}</p>${renderPressureSparkline(pressureSeries)}</article>
        </section>
      </main>`;

    resultsDiv.querySelectorAll('.daily-row').forEach((btn) => btn.addEventListener('click', () => {
        savedMainScroll = window.scrollY;
        setHashRoute('/day', { date: btn.dataset.day });
    }));
    resultsDiv.querySelector('[data-route="/map"]')?.addEventListener('click', () => setHashRoute('/map'));
}

function renderDayDetailView(data, day) {
    const dayIndex = data.weather.forecast.daily.time.indexOf(day);
    if (dayIndex < 0) return renderMainView(data);

    const daily = data.weather.forecast.daily;
    const hourly = data.weather.forecast.hourly;
    const resultsDiv = document.getElementById('results');
    const solunar = calculateSolunar(data.coords.lat, data.coords.lon, new Date(`${day}T12:00:00`));
    const score = getDayScore(data, dayIndex, solunar.moon_phase_percent);
    const state = normalizeState(score);

    const indices = hourly.time.map((t, i) => ({ t, i })).filter((x) => x.t.startsWith(day)).slice(0, 24);
    const trendData = {
        air: indices.map(({ i, t }) => ({ t: t.slice(11, 16), v: cToF(hourly.temperature_2m?.[i]) })),
        precip: indices.map(({ i, t }) => ({ t: t.slice(11, 16), v: hourly.precipitation?.[i] ?? 0 })),
        wind: indices.map(({ i, t }) => ({ t: t.slice(11, 16), v: kmhToMph(hourly.wind_speed_10m?.[i] ?? 0) }))
    };

    const radarUrl = `https://embed.windy.com/embed2.html?lat=${data.coords.lat.toFixed(3)}&lon=${data.coords.lon.toFixed(3)}&detailLat=${data.coords.lat.toFixed(3)}&detailLon=${data.coords.lon.toFixed(3)}&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=&marker=true&calendar=now`;

    resultsDiv.innerHTML = `
      <main class="fishcast-shell screen-view">
        <section class="card detail-header"><button class="back-btn" id="backToMain">Back</button><p class="hero-location">${data.coords.name}</p><h1 class="detail-title">${new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h1><p class="hero-index">${score}</p><p class="pill ${state.className}">${state.label}</p><p class="hero-explanation">${getBestWindowText(score, kmhToMph(daily.wind_speed_10m_max?.[dayIndex] || 0), daily.precipitation_probability_max?.[dayIndex] || 0)}</p></section>
        <section class="card detail-grid"><h2 class="card-header">24-Hour Trends</h2><h3>Air Temperature</h3>${renderMiniTrendChart('air', trendData.air, '°F', 1)}<h3>Precipitation</h3>${renderMiniTrendChart('precip', trendData.precip, ' mm/h', 2)}<h3>Wind</h3>${renderMiniTrendChart('wind', trendData.wind, ' mph', 0)}</section>
        <section class="card detail-grid"><h2 class="card-header">Precipitation</h2><p>${daily.precipitation_probability_max?.[dayIndex] ?? 0}% chance · ${daily.precipitation_sum?.[dayIndex] ?? 0} mm total</p></section>
        <section class="card detail-grid"><h2 class="card-header">Temperature</h2><p>${cToF(daily.temperature_2m_min?.[dayIndex] || 0).toFixed(0)}° to ${cToF(daily.temperature_2m_max?.[dayIndex] || 0).toFixed(0)}°F</p></section>
        <section class="card detail-grid"><h2 class="card-header">Sun &amp; Moon</h2><p>Sunrise: ${daily.sunrise?.[dayIndex] ? new Date(daily.sunrise[dayIndex]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p><p>Sunset: ${daily.sunset?.[dayIndex] ? new Date(daily.sunset[dayIndex]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p></section>
        <section class="card radar-card"><h2 class="card-header">Radar</h2><iframe title="Weather radar for ${data.coords.name}" loading="lazy" src="${radarUrl}"></iframe></section>
      </main>`;

    document.getElementById('backToMain')?.addEventListener('click', () => setHashRoute('/'));
    attachTrendTooltips(resultsDiv, trendData);
}

function renderMapView(data) {
    if (!data) return showEmptyState();
    const radarUrl = `https://embed.windy.com/embed2.html?lat=${data.coords.lat.toFixed(3)}&lon=${data.coords.lon.toFixed(3)}&detailLat=${data.coords.lat.toFixed(3)}&detailLon=${data.coords.lon.toFixed(3)}&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=&marker=true&calendar=now`;
    document.getElementById('results').innerHTML = `<main class="fishcast-shell screen-view"><section class="card detail-header"><button class="back-btn" id="backFromMap">Back</button><h1 class="detail-title">Radar Map</h1><p class="hero-location">${data.coords.name}</p></section><section class="card radar-card"><iframe title="Weather radar for ${data.coords.name}" loading="lazy" src="${radarUrl}"></iframe></section></main>`;
    document.getElementById('backFromMap')?.addEventListener('click', () => setHashRoute('/'));
}

export function rerenderFromRoute() {
    const { path, params } = parseHashRoute();
    if (!latestForecastData && path !== '/') return showEmptyState();
    if (path === '/day') return renderDayDetailView(latestForecastData, params.get('date'));
    if (path === '/map') return renderMapView(latestForecastData);
    renderMainView(latestForecastData);
    window.scrollTo({ top: savedMainScroll, behavior: 'auto' });
}

export function renderForecast(data) {
    latestForecastData = data;
    window.currentForecastData = data;
    sessionStorage.setItem('fishcast-last-forecast', JSON.stringify(data));
    rerenderFromRoute();
}

export function restoreLastForecast() {
    if (latestForecastData) return true;
    const serialized = sessionStorage.getItem('fishcast-last-forecast');
    if (!serialized) return false;
    try {
        latestForecastData = JSON.parse(serialized);
        window.currentForecastData = latestForecastData;
        return true;
    } catch {
        sessionStorage.removeItem('fishcast-last-forecast');
        return false;
    }
}

export function showLoading() {
    document.getElementById('results').innerHTML = '<section class="fishcast-shell"><section class="card skeleton skeleton-hero"></section></section>';
}

export function showError(message) {
    document.getElementById('results').innerHTML = `<section class="card error-card" role="alert"><h2>Forecast unavailable</h2><p>${message || 'Unable to load data.'}</p></section>`;
}

export function showEmptyState() {
    document.getElementById('results').innerHTML = '<section class="card empty-card"><h2>Set a location to begin</h2><p>Generate a forecast to view conditions.</p></section>';
}

export { parseHashRoute, setHashRoute };
