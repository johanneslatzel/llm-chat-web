import {
    createEnvReader,
    EmptyStringPolicy,
    NumberParsing,
    RangePolicy
} from '@johannes.latzel/env';

function makeEnv() {
    return createEnvReader({
        numberParsing: NumberParsing.Lenient,
        rangePolicy: RangePolicy.Clamp,
        emptyString: EmptyStringPolicy.Value
    });
}

/** Read an integer clamped to at least `min`, or the clamped fallback. */
function envInt(key: string, fallback: number, min = 1): number {
    return makeEnv().int(key, Math.max(min, fallback), min);
}

/** Read a string, preserving an explicitly empty value. */
function envString(key: string, fallback: string): string {
    return makeEnv().string(key, fallback);
}

/** Read an enum value constrained to `values`, falling back for unknown values. */
function envEnum<T extends string>(key: string, values: readonly T[], fallback: T): T {
    return makeEnv().enum(key, values, fallback);
}

export { envInt, envString, envEnum };
