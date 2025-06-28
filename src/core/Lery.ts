import { Query } from './Query'
import type {
	DataMap,
	FetchConfig,
	KeyOf,
	LeryConfig,
	MutateConfig,
	QueryKey,
	QueryOptions,
	SubscribeConfig
} from './types'
import { QueryType } from './types'
import { serializeKey } from './utils'

export class Lery<TDataMap extends DataMap> {
	private cache = new Map<number, Query<any>>()

	constructor(private config: LeryConfig = {}) {}

	// --- Internal ---

	private cleanupEntry(entry: Query<any>) {
		entry.cancel()
		entry.reset()
	}

	private getEntry<TKey extends KeyOf<TDataMap>>(
		key: QueryKey<TDataMap>,
		type: QueryType = QueryType.FETCH,
		options?: QueryOptions
	): Query<TDataMap[TKey]> {
		const cacheKey = serializeKey(key)
		let entry = this.cache.get(cacheKey)

		if (entry) return entry as Query<TDataMap[TKey]>

		this.cleanupCache()

		entry = this.newQuery(type, options)
		this.cache.set(cacheKey, entry)

		return entry as Query<TDataMap[TKey]>
	}

	private cleanupCache() {
		const maxSize = this.config.options?.maxCacheSize ?? 100
		if (this.cache.size <= maxSize) return

		const unsubscribed = Array.from(this.cache.entries()).filter(
			([, entry]) => entry.subscribersCount === 0
		)

		const entries =
			unsubscribed.length > 0 ? unsubscribed : Array.from(this.cache.entries())

		const [key, entry] = entries.reduce((a, b) =>
			a[1].lastFetchTime <= b[1].lastFetchTime ? a : b
		)

		this.cleanupEntry(entry)
		this.cache.delete(key)
	}

	private newQuery(type: QueryType, options?: QueryOptions): Query<any> {
		const mergedOptions = {
			...this.config.options,
			...options
		}

		const ttl = Math.max(
			this.config.options?.cacheTTL ?? 0,
			options?.cacheTTL ?? 0
		)

		return new Query({
			type,
			...this.config,
			options: { ...mergedOptions, cacheTTL: ttl }
		})
	}

	// --- Public API ---

	subscribe<TKey extends KeyOf<TDataMap>>({
		queryKey,
		callback
	}: SubscribeConfig<TDataMap, TKey>): () => void {
		const entry = this.getEntry<TKey>(queryKey)

		const unsubscribe = entry.subscribe(callback)
		callback(entry.state)

		return () => unsubscribe()
	}

	state<TKey extends KeyOf<TDataMap>>(key: QueryKey<TDataMap>) {
		return this.getEntry<TKey>(key).state
	}

	fetch<TKey extends KeyOf<TDataMap>>(config: FetchConfig<TDataMap, TKey>) {
		const entry = this.getEntry<TKey>(
			config.queryKey,
			QueryType.FETCH,
			config.options
		)

		return entry.query(config)
	}

	mutate<TKey extends KeyOf<TDataMap>>(config: MutateConfig<TDataMap, TKey>) {
		const entry = this.getEntry<TKey>(
			config.queryKey,
			QueryType.MUTATE,
			config.options
		)

		entry.reset()
		return entry.query(config)
	}

	invalidate(queryKey: QueryKey<TDataMap>) {
		const cacheKey = serializeKey(queryKey)
		const entry = this.cache.get(cacheKey)

		if (entry) {
			this.cleanupEntry(entry)
			this.cache.delete(cacheKey)
		}
	}

	async refetch<TKey extends KeyOf<TDataMap>>(
		queryKey: QueryKey<TDataMap>,
		queryFn: () => Promise<TDataMap[TKey]>
	) {
		const entry = this.getEntry<TKey>(queryKey, QueryType.FETCH)
		return entry.query({ queryFn })
	}

	clear() {
		for (const entry of this.cache.values()) {
			this.cleanupEntry(entry)
		}
		this.cache.clear()
	}

	getCacheStats() {
		let activeQueries = 0
		let totalSubscribers = 0

		for (const entry of this.cache.values()) {
			if (entry.subscribersCount > 0) activeQueries++
			totalSubscribers += entry.subscribersCount
		}

		return {
			totalEntries: this.cache.size,
			activeQueries,
			totalSubscribers
		}
	}
}
