import { estimateWaterTemp } from '../../js/models/waterTemp.js';
import { calculateSpeciesAwareDayScore, applyStabilityControls } from '../../js/models/forecastEngine.js';
import { getWeather } from '../../js/services/weatherAPI.js';
import { invariant, invariantFinite, invariantWithin, runInvariant } from './assert.js';
import {
    COORDS,
    WINTER_CURRENT_DATE,
    WINTER_AIR_TEMP_45_TO_55,
    buildWindScenario,
    buildTrendScenario,
    FIXED_NOW_MS,
    WEATHER_API_HISTORICAL_FIXTURE,
    WEATHER_API_FORECAST_FIXTURE,
    buildForecastEngineWeather
} from './scenarios/fixtures.js';

const storageMemo = new Map();

function installLocalStorageMock() {
    globalThis.localStorage = {
        getItem(key) {
            return storageMemo.has(key) ? storageMemo.get(key) : null;
        },
        setItem(key, value) {
            storageMemo.set(key, String(value));
        },
        removeItem(key) {
            storageMemo.delete(key);
        },
        clear() {
            storageMemo.clear();
        },
        key(index) {
            return Array.from(storageMemo.keys())[index] ?? null;
        },
        get length() {
            return storageMemo.size;
        }
    };
}

function installFetchMock(responseQueue) {
    const seenUrls = [];
    globalThis.fetch = async (url) => {
        seenUrls.push(String(url));
        const next = responseQueue.shift();
        if (!next) {
            throw new Error(`Unexpected fetch call: ${url}`);
        }
        return {
            ok: true,
            status: 200,
            async json() {
                return next;
            }
        };
    };
    return seenUrls;
}

function installDateNow(nowMs) {
    const realNow = Date.now;
    Date.now = () => nowMs;
    return () => {
        Date.now = realNow;
    };
}

async function estimateWithReports(weather, reports = []) {
    installFetchMock([reports]);
    return estimateWaterTemp(COORDS, 'lake', WINTER_CURRENT_DATE, weather);
}

async function invariantUnitSanity() {
    const estimated = await estimateWithReports(WINTER_AIR_TEMP_45_TO_55, []);
    invariantWithin(estimated, 32, 60, 'winter 45-55°F air scenario estimated surface temp');
}

async function invariantTimezoneAlignment() {
    storageMemo.clear();
    const restoreNow = installDateNow(FIXED_NOW_MS);
    const seenUrls = installFetchMock([WEATHER_API_HISTORICAL_FIXTURE, WEATHER_API_FORECAST_FIXTURE]);

    try {
        const weather = await getWeather(COORDS.lat, COORDS.lon, 3);
        invariant(seenUrls.every((url) => url.includes('timezone=auto')), 'weather API requests must use timezone=auto', { seenUrls });

        invariant(typeof weather.meta?.timezone === 'string', 'meta.timezone must exist');
        invariant(weather.meta.timezone === WEATHER_API_FORECAST_FIXTURE.timezone, 'meta.timezone must come from API timezone');

        invariantFinite(weather.meta.nowHourIndex, 'meta.nowHourIndex');
        invariant(weather.meta.nowHourIndex > 0, 'meta.nowHourIndex must represent current hour, not slice(0,n) origin');

        const nowTs = FIXED_NOW_MS;
        const indexedTime = weather.forecast.hourly.time[weather.meta.nowHourIndex];
        const indexedTs = Date.parse(indexedTime);
        const deltaHours = Math.abs(indexedTs - nowTs) / (1000 * 60 * 60);
        invariant(deltaHours <= 2, 'meta.nowHourIndex must be within ±2 hours of now', { deltaHours, indexedTime });

        const dayFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: weather.meta.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const tzNowDay = dayFormatter.format(new Date(nowTs));
        const indexedDayInTimezone = dayFormatter.format(new Date(indexedTs));
        invariant(indexedDayInTimezone === tzNowDay, 'today alignment must follow API timezone day boundary', {
            indexedDayInTimezone,
            tzNowDay,
            indexedTime
        });
    } finally {
        restoreNow();
    }
}

async function invariantWindRealism() {
    const maxOnlyLow = await estimateWithReports(buildWindScenario({ meanWind: 8, maxWind: 12 }), []);
    const maxOnlyHigh = await estimateWithReports(buildWindScenario({ meanWind: 8, maxWind: 38 }), []);
    const meanWindHigh = await estimateWithReports(buildWindScenario({ meanWind: 22, maxWind: 38 }), []);

    const maxOnlyDelta = Math.abs(maxOnlyHigh - maxOnlyLow);
    const meanDelta = Math.abs(meanWindHigh - maxOnlyLow);

    invariant(maxOnlyDelta <= meanDelta, 'mean wind must dominate over max wind in temperature impact', {
        maxOnlyDelta,
        meanDelta
    });

    const windyDelta = Math.abs(meanWindHigh - maxOnlyLow);
    invariant(windyDelta <= 3, 'wind-driven water temperature deltas >3°F are unsafe', { windyDelta });
}

async function invariantTrendSmoothness() {
    const gradual = await estimateWithReports(buildTrendScenario(69, 0.8), []);
    const slightlySteeper = await estimateWithReports(buildTrendScenario(69, 1.1), []);
    const cliffDelta = Math.abs(slightlySteeper - gradual);
    invariant(cliffDelta < 4, 'trend response must avoid hard-threshold cliff jumps', { cliffDelta });

    installFetchMock([[]]);
    const dayOne = await estimateWaterTemp(COORDS, 'lake', new Date('2026-05-10T12:00:00Z'), buildTrendScenario(69, 0.9));
    installFetchMock([[]]);
    const dayTwo = await estimateWaterTemp(COORDS, 'lake', new Date('2026-05-11T12:00:00Z'), buildTrendScenario(69.5, 0.9));
    const dailyShift = Math.abs(dayTwo - dayOne);
    invariant(dailyShift <= 3, 'day-to-day temperature changes must stay smooth without major weather shifts', { dailyShift });
}

function writeStorageObject(key, payload) {
    localStorage.setItem(key, JSON.stringify(payload));
}

async function invariantForecastScoreStability() {
    storageMemo.clear();

    const tomorrowDate = '2026-02-17';
    const locationKey = '33.7500_-84.3900';
    const speciesKey = 'bluegill';
    const stabilityKey = `fishcast_stability_${locationKey}_${speciesKey}_${tomorrowDate}`;

    const baselineInputs = {
        pressureAvg: 1016,
        windAvgKmh: 9,
        precipProbAvg: 20,
        cloudAvg: 35,
        tempAvgF: 58,
        waterTempF: 52
    };

    writeStorageObject(stabilityKey, {
        score: 20,
        inputs: baselineInputs,
        updatedAt: '2026-02-16T15:00:00.000Z'
    });

    const noChangeResult = applyStabilityControls({
        baseScore: 100,
        inputs: baselineInputs,
        speciesKey,
        locationKey,
        dateKey: tomorrowDate,
        now: new Date('2026-02-16T16:00:00.000Z')
    });

    invariant(noChangeResult.score < 100, 'bad tomorrow cannot become 100 without material regime changes', noChangeResult);

    const waterShiftResult = applyStabilityControls({
        baseScore: 100,
        inputs: { ...baselineInputs, waterTempF: 57 },
        speciesKey,
        locationKey,
        dateKey: tomorrowDate,
        now: new Date('2026-02-16T16:05:00.000Z')
    });

    invariant(waterShiftResult.score >= noChangeResult.score, 'material water-temp shift should unlock higher score movement', {
        noChange: noChangeResult.score,
        withWaterShift: waterShiftResult.score
    });
}

async function invariantUIViewModelSanity() {
    storageMemo.clear();
    const weather = buildForecastEngineWeather();
    const dayKey = weather.forecast.daily.time[1];
    const result = calculateSpeciesAwareDayScore({
        data: { weather },
        dayKey,
        speciesKey: 'bluegill',
        waterTempF: 54,
        locationKey: '33.7500_-84.3900',
        now: new Date('2026-02-16T12:00:00.000Z')
    });

    const viewModel = {
        score: result.score,
        waterTempF: 54,
        airTempF: weather.forecast.daily.temperature_2m_mean[1],
        windMph: weather.forecast.hourly.wind_speed_10m[weather.forecast.hourly.time.indexOf('2026-02-16T12:00:00.000Z')],
        metaUnits: {
            temp: 'F',
            wind: 'mph',
            precip: 'in'
        },
        charts: [
            { id: 'hourly-temperature', yAxisLabel: 'Temperature', unit: '°F' },
            { id: 'hourly-precip', yAxisLabel: 'Precipitation', unit: '%' },
            { id: 'hourly-wind', yAxisLabel: 'Wind', unit: 'mph' }
        ]
    };

    Object.entries({
        score: viewModel.score,
        waterTempF: viewModel.waterTempF,
        airTempF: viewModel.airTempF,
        windMph: viewModel.windMph
    }).forEach(([label, value]) => {
        invariantFinite(value, `ui.${label}`);
    });

    Object.entries(viewModel.metaUnits).forEach(([unitName, unitValue]) => {
        invariant(Boolean(unitValue), `ui unit ${unitName} must be present`, { unitValue });
    });

    viewModel.charts.forEach((chart) => {
        invariant(Boolean(chart.yAxisLabel), `chart ${chart.id} must include y-axis label`, chart);
        invariant(Boolean(chart.unit), `chart ${chart.id} must include unit`, chart);
    });
}

async function main() {
    installLocalStorageMock();

    const checks = [
        ['A) Unit sanity (C/F killer)', invariantUnitSanity],
        ['B) Time alignment correctness', invariantTimezoneAlignment],
        ['C) Wind realism', invariantWindRealism],
        ['D) Trend smoothness', invariantTrendSmoothness],
        ['E) Forecast score stability', invariantForecastScoreStability],
        ['F) UI view-model sanity', invariantUIViewModelSanity]
    ];

    const results = [];
    for (const [name, fn] of checks) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await runInvariant(name, fn));
    }

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
        console.error(`\nSmoke suite failed: ${failed.length} invariant(s) violated.`);
        process.exit(1);
    }

    console.log('\nSmoke suite passed: FishCast is safe to ship under current invariants.');
}

main().catch((error) => {
    console.error('❌ Smoke runner crashed');
    console.error(error);
    process.exit(1);
});
