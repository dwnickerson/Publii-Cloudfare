// Water body thermal properties and characteristics
export const WATER_BODIES_V2 = {
    pond: {
        // Re-tuned for 0-5 acre ponds (less volatile than tiny farm ponds)
        thermal_lag_days: 6,           // Responds quickly, but not instantly
        thermal_inertia_base: 0.13,    // Faster response than lakes
        seasonal_lag_days: 12,         // Peak temp lags solar by ~12 days
        annual_amplitude: 22,          // Broader than lakes, reduced vs micro-ponds
        thermocline_depth: 9,          // Feet - shallow but somewhat stable layering
        max_daily_change: 2.5,         // Max °F change per day
        deep_stable_temp: 54,          // Bottom temp in summer
        mixing_wind_threshold: 6       // mph - when wind starts mixing layers
    },
    lake: {
        // Re-tuned for lakes just above the 5 acre boundary and larger
        thermal_lag_days: 9,
        thermal_inertia_base: 0.09,
        seasonal_lag_days: 22,
        annual_amplitude: 21,
        thermocline_depth: 13,
        max_daily_change: 2.2,
        deep_stable_temp: 52,
        mixing_wind_threshold: 7
    },
    reservoir: {
        thermal_lag_days: 14,
        thermal_inertia_base: 0.05,
        seasonal_lag_days: 35,
        annual_amplitude: 18,
        thermocline_depth: 25,
        max_daily_change: 1.5,
        deep_stable_temp: 45,
        mixing_wind_threshold: 10
    }
};
