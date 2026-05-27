export function deepMerge(target: unknown, source: unknown): unknown {
	if (Array.isArray(source)) return source;
	if (typeof target !== 'object' || target === null) return source;
	if (typeof source !== 'object' || source === null) return source;
	if (Array.isArray(target)) return source;

	const result = { ...(target as Record<string, unknown>) };
	for (const key of Object.keys(source as Record<string, unknown>)) {
		const src = (source as Record<string, unknown>)[key];
		const tgt = result[key];
		if (
			typeof src === 'object' &&
			src !== null &&
			!Array.isArray(src) &&
			typeof tgt === 'object' &&
			tgt !== null &&
			!Array.isArray(tgt)
		) {
			result[key] = deepMerge(tgt, src);
		} else {
			result[key] = src;
		}
	}
	return result;
}
