// Enhanced Forecast UI Rendering with Weather Icons & Clickable Days
import { SPECIES_DATA } from '../config/species.js';
import { cToF, kmhToMph, getWindDirection } from '../utils/math.js';
import { formatDate, formatDateShort } from '../utils/date.js';
import { calculateFishingScore, getTechniqueTips, getPressureTrend } from '../models/fishingScore.js';
import { calculateSolunar } from '../models/solunar.js';
import { estimateTempByDepth } from '../models/waterTemp.js';

// Get weather icon based on code
function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '☁️';
}

// Get moon phase icon
function getMoonIcon(phase) {
    if (phase.includes('New')) return '🌑';
    if (phase.includes('Waxing Crescent')) return '🌒';
    if (phase.includes('First Quarter')) return '🌓';
    if (phase.includes('Waxing Gibbous')) return '🌔';
    if (phase.includes('Full')) return '🌕';
    if (phase.includes('Waning Gibbous')) return '🌖';
    if (phase.includes('Last Quarter')) return '🌗';
    if (phase.includes('Waning Crescent')) return '🌘';
    return '🌙';
}

// Get pressure trend indicator
function getPressureIndicator(trend) {
    if (trend === 'rapid_fall' || trend === 'falling') return '<span class="pressure-falling">Falling</span>';
    if (trend === 'rapid_rise' || trend === 'rising') return '<span class="pressure-rising">Rising</span>';
    return '<span class="pressure-stable">Stable</span>';
}

export function renderForecast(data) {
    const { coords, waterTemp, weather, speciesKey, waterType, days } = data;
    
    const resultsDiv = document.getElementById('results');
    const speciesData = SPECIES_DATA[speciesKey];
    
    // Calculate today's score
    const currentScore = calculateFishingScore(weather.forecast, waterTemp, speciesKey);
    const solunar = calculateSolunar(coords.lat, coords.lon, new Date());
    const windSpeed = kmhToMph(weather.forecast.current.wind_speed_10m);
    const windDir = getWindDirection(weather.forecast.current.wind_direction_10m);
    const tips = getTechniqueTips(currentScore.score, waterTemp, windSpeed, weather.forecast, speciesKey);
    const pTrend = getPressureTrend(weather.forecast.hourly.surface_pressure.slice(0, 6));
    
    // Weather icon
    const weatherIcon = getWeatherIcon(weather.forecast.current.weather_code);
    const moonIcon = getMoonIcon(solunar.moon_phase);
    
    // Start building HTML
    let html = `
        <div class="score-header">
            <h2>${weatherIcon} Today's Forecast</h2>
            <div class="score-display ${currentScore.colorClass}">${currentScore.score}</div>
            <div class="rating ${currentScore.colorClass}">${currentScore.rating}</div>
            <div class="location-info">
                📍 ${coords.name} | 🐟 ${speciesData.name}
            </div>
        </div>
        
        <div class="action-buttons">
            <button class="action-btn primary" onclick="window.openCatchLog()">📊 Log Catch</button>
            <button class="action-btn" onclick="window.shareForecast()">📱 Share</button>
            <button class="action-btn" onclick="window.saveFavorite()">⭐ Save Location</button>
            <button class="action-btn success" onclick="window.openTempReport()">🌡️ Submit Water Temp</button>
        </div>
        
        <div class="tips-card">
            <h3>🎣 Fishing Tips for Today</h3>
            ${tips.map(tip => `<div class="tip-item">${tip}</div>`).join('')}
        </div>
        
        <div class="details-grid">
            <div class="detail-card">
                <h3><span class="water-icon"></span>Water Conditions</h3>
                <div class="detail-row">
                    <span class="detail-label">Water Temperature</span>
                    <span class="detail-value">
                        🌡️ Surface: ${waterTemp.toFixed(1)}°F<br>
                        <small style="color: var(--text-secondary);">
                            📏 10ft: ${estimateTempByDepth(waterTemp, waterType, 10).toFixed(1)}°F | 
                            20ft: ${estimateTempByDepth(waterTemp, waterType, 20).toFixed(1)}°F
                        </small>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Air Temperature</span>
                    <span class="detail-value">
                        🌡️ ${cToF(weather.forecast.current.temperature_2m).toFixed(1)}°F 
                        <small>(feels like ${cToF(weather.forecast.current.apparent_temperature).toFixed(1)}°F)</small>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fish Phase</span>
                    <span class="detail-value">🐠 ${currentScore.phase.replace('_', ' ')}</span>
                </div>
            </div>
            
            <div class="detail-card">
                <h3><span class="cloud-icon"></span>Weather</h3>
                <div class="detail-row">
                    <span class="detail-label">Conditions</span>
                    <span class="detail-value">${weatherIcon} ${getWeatherDescription(weather.forecast.current.weather_code)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Barometric Pressure</span>
                    <span class="detail-value">
                        📊 ${weather.forecast.current.surface_pressure} mb 
                        <small>(${(weather.forecast.current.surface_pressure * 0.02953).toFixed(2)} inHg)</small>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Pressure Trend</span>
                    <span class="detail-value">
                        ${getPressureIndicator(pTrend)}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Wind</span>
                    <span class="detail-value">💨 ${windSpeed.toFixed(1)} mph ${windDir}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Humidity</span>
                    <span class="detail-value">💧 ${weather.forecast.current.relative_humidity_2m}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Cloud Cover</span>
                    <span class="detail-value">☁️ ${weather.forecast.current.cloud_cover}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Precipitation</span>
                    <span class="detail-value">
                        ${weather.forecast.hourly.precipitation_probability[0] > 30 ? '🌧️' : '☀️'} 
                        ${weather.forecast.hourly.precipitation_probability[0] || 0}% chance
                    </span>
                </div>
            </div>
            
            <div class="detail-card">
                <h3><span class="moon-icon"></span>Solunar</h3>
                <div class="detail-row">
                    <span class="detail-label">Moon Phase</span>
                    <span class="detail-value">${moonIcon} ${solunar.moon_phase} (${solunar.moon_phase_percent}%)</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Major Periods</span>
                    <span class="detail-value" style="line-height: 1.8;">
                        🌟 ${solunar.major_periods[0]}<br>
                        🌟 ${solunar.major_periods[1]}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Minor Periods</span>
                    <span class="detail-value" style="line-height: 1.8;">
                        ⭐ ${solunar.minor_periods[0]}<br>
                        ⭐ ${solunar.minor_periods[1]}
                    </span>
                </div>
            </div>
        </div>
    `;
    
    // Multi-day forecast if requested
    if (days > 1) {
        html += renderMultiDayForecast(weather, speciesKey, waterType, coords);
    }
    
    resultsDiv.innerHTML = html;
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Store forecast data for sharing
    window.currentForecastData = data;
}

function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear Sky',
        1: 'Mainly Clear',
        2: 'Partly Cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Rime Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Dense Drizzle',
        61: 'Slight Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        71: 'Slight Snow',
        73: 'Moderate Snow',
        75: 'Heavy Snow',
        80: 'Light Showers',
        81: 'Moderate Showers',
        82: 'Violent Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Hail',
        99: 'Severe Thunderstorm'
    };
    return descriptions[code] || 'Unknown';
}

function renderMultiDayForecast(weather, speciesKey, waterType, coords) {
    let html = '<div class="multi-day-forecast"><h3>📅 Extended Forecast</h3><div class="forecast-days">';
    
    const dailyData = weather.forecast.daily;
    
    for (let i = 0; i < dailyData.time.length; i++) {
        const date = dailyData.time[i];
        const maxTemp = cToF(dailyData.temperature_2m_max[i]);
        const minTemp = cToF(dailyData.temperature_2m_min[i]);
        const precipProb = dailyData.precipitation_probability_max[i];
        const weatherCode = dailyData.weather_code[i];
        const weatherIcon = getWeatherIcon(weatherCode);
        
        // Simple score estimation for future days
        const avgTemp = (maxTemp + minTemp) / 2;
        const estimatedScore = Math.max(30, Math.min(85, 50 + (avgTemp - 60) * 0.5));
        
        let scoreClass = 'fair';
        if (estimatedScore >= 80) scoreClass = 'excellent';
        else if (estimatedScore >= 65) scoreClass = 'good';
        else if (estimatedScore >= 50) scoreClass = 'fair';
        else scoreClass = 'poor';
        
        html += `
            <div class="forecast-day-card" onclick="window.showDayDetails(${i}, '${date}')" data-day="${i}">
                <div class="day-header">${formatDateShort(date)}</div>
                <div style="font-size: 2rem; margin: 10px 0;">${weatherIcon}</div>
                <div class="day-score ${scoreClass}">${Math.round(estimatedScore)}</div>
                <div class="day-temp">${maxTemp.toFixed(0)}° / ${minTemp.toFixed(0)}°</div>
                <div class="day-precip">💧 ${precipProb}%</div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}

// Function to show detailed day information
window.showDayDetails = function(dayIndex, date) {
    const data = window.currentForecastData;
    if (!data) return;
    
    const dailyData = data.weather.forecast.daily;
    const weatherCode = dailyData.weather_code[dayIndex];
    const maxTemp = cToF(dailyData.temperature_2m_max[dayIndex]);
    const minTemp = cToF(dailyData.temperature_2m_min[dayIndex]);
    const precipProb = dailyData.precipitation_probability_max[dayIndex];
    const weatherIcon = getWeatherIcon(weatherCode);
    const weatherDesc = getWeatherDescription(weatherCode);
    
    // Highlight selected day
    document.querySelectorAll('.forecast-day-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`.forecast-day-card[data-day="${dayIndex}"]`).classList.add('active');
    
    // Show detailed modal
    const modalHTML = `
        <div class="modal show" id="dayDetailModal" onclick="if(event.target === this) this.classList.remove('show')">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <span class="modal-close" onclick="document.getElementById('dayDetailModal').classList.remove('show')">×</span>
                    ${weatherIcon} ${formatDate(date)}
                </div>
                <div style="padding: 20px 0;">
                    <div class="detail-row">
                        <span class="detail-label">Conditions</span>
                        <span class="detail-value">${weatherIcon} ${weatherDesc}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">High / Low</span>
                        <span class="detail-value">🌡️ ${maxTemp.toFixed(1)}°F / ${minTemp.toFixed(1)}°F</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Precipitation</span>
                        <span class="detail-value">💧 ${precipProb}% chance</span>
                    </div>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--border-color);">
                        <p style="color: var(--text-secondary); text-align: center;">
                            <small>Click outside to close</small>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove old modal if exists
    const oldModal = document.getElementById('dayDetailModal');
    if (oldModal) oldModal.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

export function showLoading() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>🎣 Analyzing conditions...</p></div>';
}

export function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="error-card" style="background: var(--bg-card); padding: 40px; border-radius: 16px; text-align: center; margin: 40px 0;">
            <h3 style="font-size: 2rem; margin-bottom: 20px;">⚠️ Error</h3>
            <p style="font-size: 1.1rem; margin-bottom: 20px;">${message}</p>
            <p style="color: var(--text-secondary);">Please try again or contact support if the problem persists.</p>
        </div>
    `;
}
