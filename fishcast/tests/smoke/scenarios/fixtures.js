function buildHourlyTimes(startIso, count, stepHours = 1) {
    const start = Date.parse(startIso);
    return Array.from({ length: count }, (_, index) => new Date(start + (index * stepHours * 60 * 60 * 1000)).toISOString());
}

function buildSeries(count, value) {
    return Array.from({ length: count }, () => value);
}

export const COORDS = { lat: 33.75, lon: -84.39 };

export const WINTER_CURRENT_DATE = new Date('2026-02-15T12:00:00Z');

export const WINTER_AIR_TEMP_45_TO_55 = {
    daily: {
        temperature_2m_mean: [46, 48, 49, 50, 51, 52, 54],
        cloud_cover_mean: [62, 58, 60, 61, 57, 59, 63],
        wind_speed_10m_mean: [7, 8, 8, 7, 9, 8, 8],
        wind_speed_10m_max: [12, 14, 13, 12, 15, 14, 14],
        precipitation_sum: [0, 0.05, 0, 0, 0.1, 0, 0]
    },
    forecast: {
        hourly: {
            wind_speed_10m: buildSeries(72, 8)
        }
    },
    meta: {
        nowHourIndex: 24
    }
};

export function buildWindScenario({ meanWind, maxWind }) {
    return {
        daily: {
            temperature_2m_mean: [68, 69, 70, 70, 71, 71, 72],
            cloud_cover_mean: [45, 45, 45, 46, 45, 44, 45],
            wind_speed_10m_mean: buildSeries(7, meanWind),
            wind_speed_10m_max: buildSeries(7, maxWind),
            precipitation_sum: [0, 0, 0, 0.1, 0, 0, 0]
        },
        forecast: {
            hourly: {
                wind_speed_10m: buildSeries(72, meanWind)
            }
        },
        meta: {
            nowHourIndex: 24
        }
    };
}

export function buildTrendScenario(startTemp, slopePerDay) {
    return {
        daily: {
            temperature_2m_mean: Array.from({ length: 7 }, (_, idx) => Number((startTemp + (idx * slopePerDay)).toFixed(2))),
            cloud_cover_mean: [50, 49, 48, 47, 46, 45, 45],
            wind_speed_10m_mean: [6, 6, 6, 7, 7, 7, 7],
            wind_speed_10m_max: [10, 11, 10, 12, 11, 12, 11],
            precipitation_sum: [0, 0, 0, 0, 0, 0, 0]
        },
        forecast: {
            hourly: {
                wind_speed_10m: buildSeries(72, 7)
            }
        },
        meta: {
            nowHourIndex: 24
        }
    };
}

export const FIXED_NOW_MS = Date.parse('2026-02-16T00:30:00Z');

const hourlyTimes = buildHourlyTimes('2026-02-15T00:00:00-06:00', 72, 1);

export const WEATHER_API_HISTORICAL_FIXTURE = {
    daily: {
        temperature_2m_mean: [47, 48, 49, 50, 51, 52, 53],
        precipitation_sum: [0, 0, 0.1, 0, 0, 0.05, 0]
    }
};

export const WEATHER_API_FORECAST_FIXTURE = {
    timezone: 'America/Chicago',
    current: {
        temperature_2m: 51,
        surface_pressure: 1016,
        wind_speed_10m: 8,
        cloud_cover: 55,
        weather_code: 2,
        precipitation: 0
    },
    current_units: {
        temperature_2m: '°F',
        wind_speed_10m: 'mph'
    },
    hourly_units: {
        wind_speed_10m: 'mph'
    },
    hourly: {
        time: hourlyTimes,
        temperature_2m: Array.from({ length: 72 }, (_, i) => 48 + (i % 24) * 0.3),
        surface_pressure: Array.from({ length: 72 }, (_, i) => 1018 - (i * 0.1)),
        wind_speed_10m: Array.from({ length: 72 }, (_, i) => 6 + (i % 6)),
        wind_direction_10m: buildSeries(72, 180),
        cloud_cover: Array.from({ length: 72 }, (_, i) => 35 + (i % 30)),
        weather_code: buildSeries(72, 2),
        precipitation_probability: Array.from({ length: 72 }, (_, i) => 10 + (i % 40))
    },
    daily: {
        time: ['2026-02-15', '2026-02-16', '2026-02-17'],
        temperature_2m_mean: [50, 52, 54],
        temperature_2m_max: [57, 58, 60],
        temperature_2m_min: [44, 45, 47],
        precipitation_probability_max: [30, 40, 50],
        precipitation_sum: [0, 0.1, 0.2],
        wind_speed_10m_max: [16, 18, 19],
        wind_direction_10m_dominant: [180, 190, 200],
        cloud_cover_mean: [45, 50, 55],
        sunrise: ['2026-02-15T06:45:00-06:00', '2026-02-16T06:44:00-06:00', '2026-02-17T06:43:00-06:00'],
        sunset: ['2026-02-15T17:40:00-06:00', '2026-02-16T17:41:00-06:00', '2026-02-17T17:42:00-06:00'],
        weather_code: [2, 3, 61]
    }
};

export function buildForecastEngineWeather() {
    return {
        historical: WEATHER_API_HISTORICAL_FIXTURE,
        forecast: WEATHER_API_FORECAST_FIXTURE
    };
}
