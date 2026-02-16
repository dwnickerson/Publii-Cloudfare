export function invariant(condition, message, context = {}) {
    if (!condition) {
        const detail = Object.keys(context).length ? ` | context=${JSON.stringify(context)}` : '';
        throw new Error(`${message}${detail}`);
    }
}

export function invariantFinite(value, label) {
    invariant(value !== null && value !== undefined, `${label} must be non-null`, { value });
    invariant(Number.isFinite(value), `${label} must be finite`, { value });
}

export function invariantWithin(value, min, max, label) {
    invariantFinite(value, label);
    invariant(value >= min && value <= max, `${label} must be within [${min}, ${max}]`, { value, min, max });
}

export async function runInvariant(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        return { name, passed: true };
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   ${error.message}`);
        return { name, passed: false, error };
    }
}
