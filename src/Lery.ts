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

	private setupCleanup = () => {
		const ttl = this.config.options?.cacheTTL ?? 180000
		this.cleanupTimer = setInterval(this.cleanup, ttl)
		return () => this.cleanupTimer && clearInterval(this.cleanupTimer)
	}

	private cleanup = () => {
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
		options?: Partial<LeryConfig['options']>
	) {
		const cacheKey = serializeKey(key)
		let entry = this.cache.get(cacheKey)

		if (!entry) {
			const ttl = Math.max(
				this.config.options?.cacheTTL ?? 0,
				options?.cacheTTL ?? 0
			)
			entry = new Query({
				...this.config,
				type,
				options: { ...this.config.options, ...options, cacheTTL: ttl }
			})
			this.cache.set(cacheKey, entry)
		}
		return entry as Query<CacheValue<TDataMap, TKey>>
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

	state<TKey extends KeyOf<TDataMap>>(key: CacheKey<TDataMap>) {
		return this.getEntry<TKey>(key).state
	}
}
