function envInt(key: string, fallback: number, min = 1): number {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return Math.max(min, fallback);
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? Math.max(min, fallback) : Math.max(min, parsed);
}

function envString(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}

function envEnum<T extends string>(key: string, values: readonly T[], fallback: T): T {
    const raw = process.env[key];
    if (raw && values.includes(raw as T)) return raw as T;
    return fallback;
}

export { envInt, envString, envEnum };
