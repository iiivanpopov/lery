function fnv1aHash(str: string): number {
	let hash = 2166136261
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i)
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
		hash >>>= 0
	}
	return hash >>> 0
}

export function serializeKey(key: any[]): number {
	return fnv1aHash(key.join('\x1F'))
}
