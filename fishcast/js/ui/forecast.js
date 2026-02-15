import { cToF, kmhToMph, getWindDirection } from '../utils/math.js';
import { calculateFishingScore, getPressureRate } from '../models/fishingScore.js';
import { calculateSolunar } from '../models/solunar.js';

function normalizeState(score) {
    if (score >= 80) return { label: 'Good', className: 'state-good' };
    if (score >= 60) return { label: 'Fair', className: 'state-fair' };
    return { label: 'Poor', className: 'state-poor' };
}

function getStartIndex(hourlyTimes = [], currentTime) {
    if (!currentTime || !hourlyTimes.length) return 0;
    const index = hourlyTimes.indexOf(currentTime);
    return index >= 0 ? index : 0;
}

function getHourLabel(isoString, offset = 0) {
    if (offset === 0) return 'Now';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildHourlyItems(weather, waterTemp, speciesKey, moonPhasePercent) {
    const { hourly, current, daily } = weather.forecast;
    const startIndex = getStartIndex(hourly.time, current.time);
    const recentPrecip = weather.historical?.daily?.precipitation_sum?.slice(-3) || [];
    const precipWindow = recentPrecip.length ? recentPrecip : (daily.precipitation_sum || []);

    const items = [];
    for (let i = 0; i < 6; i++) {
        const idx = startIndex + i;
        if (!hourly.time[idx]) break;

        const pseudoWeather = {
            current: {
                surface_pressure: hourly.surface_pressure[idx] ?? current.surface_pressure,
                wind_speed_10m: hourly.wind_speed_10m[idx] ?? current.wind_speed_10m,
                cloud_cover: hourly.cloud_cover[idx] ?? current.cloud_cover,
                weather_code: hourly.weather_code[idx] ?? current.weather_code
            },
            hourly: {
                surface_pressure: hourly.surface_pressure.slice(idx, idx + 6),
                precipitation_probability: [hourly.precipitation_probability[idx] ?? 0]
            },
            daily: {
                precipitation_sum: precipWindow
            }
        };

        const hourScore = calculateFishingScore(pseudoWeather, waterTemp, speciesKey, moonPhasePercent);
        items.push({
            time: getHourLabel(hourly.time[idx], i),
            score: hourScore.score,
            state: normalizeState(hourScore.score)
        });
    }

    return items;
}

function describePressureTrend(trend) {
    if (trend === 'rapid_fall' || trend === 'falling') return 'falling pressure';
    if (trend === 'rapid_rise' || trend === 'rising') return 'rising pressure';
    return 'stable pressure';
}

function createExplanation({ precipProb, pressureTrend, windMph }) {
    const rainText = precipProb >= 60 ? 'Higher rain chances' : precipProb >= 25 ? 'Light rain potential' : 'Mostly dry skies';
    const pressureText = describePressureTrend(pressureTrend);
    const windText = windMph > 16 ? 'stronger wind' : windMph > 8 ? 'moderate wind' : 'lighter wind';
    return `${rainText} and ${pressureText} with ${windText} shape activity today.`;
}

function getBestWindowText(score, windMph, precipProb) {
    if (score >= 80) return 'Best: Morning';
    if (score >= 70) return 'All Day Stable';
    if (windMph > 14) return 'Sheltered Banks';
    if (precipProb > 55) return 'Before Rain Peaks';
    return 'Fair Late Morning';
}

function buildDailyRows(data, waterTemp, moonPhasePercent) {
    const { weather, speciesKey } = data;
    const daily = weather.forecast.daily;
    const rows = [];

    for (let i = 0; i < Math.min(daily.time.length, 5); i++) {
        const weatherSlice = {
            current: {
                surface_pressure: daily.surface_pressure_mean?.[i] ?? weather.forecast.current.surface_pressure,
                wind_speed_10m: daily.wind_speed_10m_max?.[i] ?? weather.forecast.current.wind_speed_10m,
                cloud_cover: daily.cloud_cover_mean?.[i] ?? weather.forecast.current.cloud_cover,
                weather_code: daily.weather_code?.[i] ?? weather.forecast.current.weather_code
            },
            hourly: {
                surface_pressure: [daily.surface_pressure_mean?.[i] ?? weather.forecast.current.surface_pressure],
                precipitation_probability: [daily.precipitation_probability_max?.[i] ?? 0]
            },
            daily: {
                precipitation_sum: (weather.historical?.daily?.precipitation_sum || []).concat((daily.precipitation_sum || []).slice(0, i + 1)).slice(-3)
            }
        };

        const score = calculateFishingScore(weatherSlice, waterTemp, speciesKey, moonPhasePercent).score;
        const windMph = kmhToMph(daily.wind_speed_10m_max?.[i] || 0);
        const precipProb = daily.precipitation_probability_max?.[i] || 0;
        const date = new Date(`${daily.time[i]}T12:00:00`);
        rows.push({
            day: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' }),
            score,
            state: normalizeState(score),
            window: getBestWindowText(score, windMph, precipProb)
        });
    }

    return rows;
}

function moonLabel(percent) {
    if (percent <= 5 || percent >= 95) return 'New / Full Cycle';
    if (percent < 50) return 'Waxing Crescent';
    if (percent === 50) return 'Quarter Moon';
    return 'Waning Crescent';
}

export function renderForecast(data) {
    const { coords, waterTemp, weather, speciesKey } = data;
    const resultsDiv = document.getElementById('results');
    const solunar = calculateSolunar(coords.lat, coords.lon, new Date());

    const scoreWeather = {
        ...weather.forecast,
        daily: {
            ...weather.forecast.daily,
            precipitation_sum: weather.historical?.daily?.precipitation_sum?.slice(-3) || weather.forecast.daily.precipitation_sum || []
        }
    };

    const currentScore = calculateFishingScore(scoreWeather, waterTemp, speciesKey, solunar.moon_phase_percent);
    const state = normalizeState(currentScore.score);

    const pressureSeries = weather.forecast.hourly.surface_pressure.slice(0, 6);
    const pressureAnalysis = getPressureRate(pressureSeries);
    const pressureCurrent = (weather.forecast.current.surface_pressure * 0.02953).toFixed(2);
    const pressureDelta = ((pressureSeries[pressureSeries.length - 1] - pressureSeries[0]) * 0.02953).toFixed(2);

    const windMph = kmhToMph(weather.forecast.current.wind_speed_10m);
    const windDir = getWindDirection(weather.forecast.current.wind_direction_10m);
    const windGust = kmhToMph(weather.forecast.current.wind_gusts_10m || weather.forecast.current.wind_speed_10m);
    const precipProbNow = weather.forecast.hourly.precipitation_probability?.[0] || weather.forecast.daily.precipitation_probability_max?.[0] || 0;

    const explanation = createExplanation({
        precipProb: precipProbNow,
        pressureTrend: pressureAnalysis.trend,
        windMph
    });

    const hourlyItems = buildHourlyItems(weather, waterTemp, speciesKey, solunar.moon_phase_percent);
    const dailyRows = buildDailyRows(data, waterTemp, solunar.moon_phase_percent);

    const trendDirection = pressureAnalysis.rate <= 0 ? '↓' : '↑';
    const trendPhrase = pressureAnalysis.rate <= 0 ? 'increasing activity early' : 'steady midday movement';

    resultsDiv.innerHTML = `
        <section class="fishcast-shell" aria-label="Fishing conditions summary">
            <section class="hero-card glass-card" aria-live="polite">
                <p class="hero-location">${coords.name}</p>
                <h2 class="hero-title">Fishing Conditions</h2>
                <p class="hero-index">${currentScore.score}</p>
                <p class="state-pill ${state.className}">${state.label}</p>
                <p class="hero-explanation">${explanation}</p>
            </section>

            <section class="glass-card hourly-card" aria-label="Hourly timeline">
                <div class="hourly-track" aria-hidden="true"></div>
                <div class="hourly-scroll" role="list">
                    ${hourlyItems.map((item) => `
                        <article class="hourly-item" role="listitem">
                            <p class="hourly-time">${item.time}</p>
                            <span class="hourly-glyph" aria-hidden="true"></span>
                            <p class="hourly-score ${item.state.className}">${item.score}</p>
                            <p class="hourly-state">${item.state.label}</p>
                        </article>
                    `).join('')}
                </div>
            </section>

            <section class="glass-card daily-card" aria-label="Daily forecast">
                <div class="daily-header-row">
                    <h3>Daily Forecast</h3>
                </div>
                <div class="daily-rows">
                    ${dailyRows.map((row) => `
                        <article class="daily-row">
                            <p class="daily-day">${row.day}</p>
                            <p class="daily-window ${row.state.className}">${row.window}</p>
                            <p class="daily-score-value">${row.score}</p>
                        </article>
                    `).join('')}
                </div>
            </section>

            <section class="metrics-grid" aria-label="Condition metrics">
                <article class="glass-card metric-card">
                    <h4>Fish Activity Trend</h4>
                    <p class="metric-value">${pressureCurrent} ${trendDirection} <span>inHg</span></p>
                    <p class="metric-note">Trend indicates ${trendPhrase}.</p>
                </article>
                <article class="glass-card metric-card">
                    <h4>Pressure Change</h4>
                    <p class="metric-value">${pressureDelta} <span>inHg</span></p>
                    <p class="metric-note">${describePressureTrend(pressureAnalysis.trend)} supports feeding shifts.</p>
                </article>
                <article class="glass-card metric-card">
                    <h4>Wind Conditions</h4>
                    <p class="metric-value">${windMph.toFixed(0)} <span>mph ${windDir}</span></p>
                    <p class="metric-note">Gusts around ${windGust.toFixed(0)} mph today.</p>
                </article>
                <article class="glass-card metric-card">
                    <h4>Moon &amp; Light</h4>
                    <p class="metric-value">${moonLabel(solunar.moon_phase_percent)}</p>
                    <p class="metric-note">${solunar.moon_phase_percent}% illumination can alter shallow bites.</p>
                </article>
            </section>
        </section>
    `;

    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.currentForecastData = data;
}

export function showLoading() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <section class="fishcast-shell" aria-label="Loading forecast">
            <section class="glass-card skeleton skeleton-hero"></section>
            <section class="glass-card skeleton skeleton-hourly"></section>
            <section class="glass-card skeleton skeleton-daily"></section>
            <section class="metrics-grid">
                <div class="glass-card skeleton skeleton-metric"></div>
                <div class="glass-card skeleton skeleton-metric"></div>
                <div class="glass-card skeleton skeleton-metric"></div>
                <div class="glass-card skeleton skeleton-metric"></div>
            </section>
        </section>
    `;
}

export function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <section class="glass-card error-card" role="alert">
            <h3>Unable to load forecast</h3>
            <p>${message}</p>
            <button type="button" class="retry-btn" onclick="window.retryForecast()">Retry</button>
        </section>
    `;
}

window.retryForecast = function retryForecast() {
    document.getElementById('forecastForm')?.requestSubmit();
};
