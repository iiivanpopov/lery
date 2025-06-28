import { serializeKey } from './hash.ts'
import { Query } from './Query.ts'
import type {
	CacheKey,
	CacheValue,
	DataMap,
	FetchConfig,
	KeyOf,
	LeryConfig,
	MutateConfig,
	QueryOptions,
	SubscribeConfig
} from './types'
import { QueryType } from './types.ts'

export class Lery<TDataMap extends DataMap> {
	private cache = new Map<number, Query<any>>()
	private cleanupTimer: any = null
	readonly stopCleanup: () => void

	constructor(private config: LeryConfig = {}) {
		this.stopCleanup = this.setupCleanup()
	}

	private setupCleanup() {
		const ttl = this.config.options?.cacheTTL ?? 180000
		this.cleanupTimer = setInterval(this.cleanup, ttl)
		return () => this.cleanupTimer && clearInterval(this.cleanupTimer)
	}

	private cleanup() {
		const now = Date.now()
		for (const [key, entry] of this.cache) {
			if (now >= entry.lastFetchTime + entry.cacheTTL) {
				this.cache.delete(key)
			}
		}
	}

	private getEntry<TKey extends KeyOf<TDataMap>>(
		key: CacheKey<TDataMap>,
		type: QueryType = QueryType.FETCH,
		options?: QueryOptions
	) {
		const cacheKey = serializeKey(key)

		let entry = this.cache.get(cacheKey)
		if (entry) return entry as Query<CacheValue<TDataMap, TKey>>

		this.cleanupCache()
		entry = this.newQuery(type, options)
		this.cache.set(cacheKey, entry)

		return entry as Query<CacheValue<TDataMap, TKey>>
	}

	private cleanupCache() {
		const maxSize = this.config.options?.maxCacheSize ?? 100
		if (this.cache.size <= maxSize) return

		const oldestKey = this.cache.keys().next().value
		if (!oldestKey) return

		const entry = this.cache.get(oldestKey)
		if (!entry) return

		entry.cancel()
		entry.reset()
		this.cache.delete(oldestKey)
	}

	private newQuery(type: QueryType, options?: QueryOptions) {
		const ttl = Math.max(
			this.config.options?.cacheTTL ?? 0,
			options?.cacheTTL ?? 0
		)

		return new Query({
			type,
			...this.config,
			options: { ...this.config.options, ...options, cacheTTL: ttl }
		})
	}

	subscribe<TKey extends KeyOf<TDataMap>>({
		queryKey,
		callback
	}: SubscribeConfig<TDataMap, TKey>): () => void {
		const entry = this.getEntry<TKey>(queryKey)
		entry.subscribers.add(callback)
		callback(entry.state)

		return () => {
			entry.subscribers.delete(callback)
			if (!entry.subscribers.size) {
				this.cache.delete(serializeKey(queryKey))
			}
		}
	}

	state<TKey extends KeyOf<TDataMap>>(key: CacheKey<TDataMap>) {
		return this.getEntry<TKey>(key).state
	}

	fetch<TKey extends KeyOf<TDataMap>>(config: FetchConfig<TDataMap, TKey>) {
		return this.getEntry(
			config.queryKey,
			QueryType.FETCH,
			config.options
		).query(config)
	}

	mutate<TKey extends KeyOf<TDataMap>>(config: MutateConfig<TDataMap, TKey>) {
		const entry = this.getEntry(
			config.queryKey,
			QueryType.MUTATE,
			config.options
		)
		entry.reset()
		return entry.query(config)
	}
}
