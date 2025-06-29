import { Query } from './Query'
import type {
	DataMap,
	FetchConfig,
	LeryConfig,
	MutateConfig,
	Plugin,
	QueryKeyFor,
	QueryOptions,
	Subscriber
} from './types'
import { QueryType } from './types'
import { serializeKey } from './utils'

export class Lery<TDataMap extends DataMap> {
	private cache = new Map<number, Query<any>>()
	private plugins: Plugin<TDataMap>[] = []

	use(plugin: Plugin<TDataMap>) {
		this.plugins.push(plugin)
		plugin.onInit?.(this)
	}

	constructor(private config: LeryConfig = {}) {}

	// --- Internal ---

	private cleanupEntry(entry: Query<any>) {
		entry.cancel()
		entry.reset()
	}

	private cleanupCache() {
		const now = Date.now()
		const maxSize = this.config.options?.maxCacheSize ?? 100

		const keysToDelete: number[] = []
		for (const [key, entry] of this.cache.entries()) {
			const ttl = entry.cacheTTL
			if (
				ttl > 0 &&
				now - entry.lastFetchTime > ttl &&
				entry.subscribersCount === 0
			) {
				keysToDelete.push(key)
			}
		}
		for (const key of keysToDelete) {
			const entry = this.cache.get(key)
			if (entry) {
				this.cleanupEntry(entry)
				this.cache.delete(key)
			}
		}

		if (this.cache.size <= maxSize) return

		const candidates = Array.from(this.cache.entries()).filter(
			([, entry]) => entry.subscribersCount === 0
		)
		const entries =
			candidates.length > 0 ? candidates : Array.from(this.cache.entries())

		if (entries.length === 0) return

		let oldest = entries[0]!

		for (const entry of entries) {
			if (entry[1].lastFetchTime < oldest[1].lastFetchTime) {
				oldest = entry
			}
		}

		this.cleanupEntry(oldest[1])
		this.cache.delete(oldest[0])
	}

	private validateQueryOptions(opts: QueryOptions) {
		if (opts.dedupingTime !== undefined && opts.dedupingTime < 0) {
			throw new Error('dedupingTime must be >= 0')
		}
		if (opts.cacheTTL !== undefined && opts.cacheTTL < 0) {
			throw new Error('cacheTTL must be >= 0')
		}
		if (opts.staleTime !== undefined && opts.staleTime < 0) {
			throw new Error('staleTime must be >= 0')
		}
		if (opts.refreshInterval !== undefined && opts.refreshInterval < 0) {
			throw new Error('refreshInterval must be >= 0')
		}
		if (
			opts.cacheTTL !== undefined &&
			opts.staleTime !== undefined &&
			opts.cacheTTL < opts.staleTime
		) {
			throw new Error('cacheTTL must be >= staleTime')
		}
	}

	private newQuery(type: QueryType, options?: QueryOptions): Query<any> {
		const mergedOptions = {
			...this.config.options,
			...options
		}

		this.validateQueryOptions(mergedOptions)

		return new Query({
			type,
			...this.config,
			options: { ...mergedOptions },
			plugins: this.plugins
		})
	}

	// --- Public API ---

	subscribe<TKey extends keyof TDataMap>({
		queryKey,
		callback
	}: {
		queryKey: QueryKeyFor<TDataMap, TKey>
		callback: Subscriber<TDataMap[TKey]>
	}): () => void {
		const entry = this.getEntry<TKey>(queryKey)

		const unsubscribe = entry.subscribe(callback)
		callback(entry.state)

		return () => unsubscribe()
	}

	state<TKey extends keyof TDataMap>(key: QueryKeyFor<TDataMap, TKey>) {
		return this.getEntry<TKey>(key).state
	}

	fetch<TKey extends keyof TDataMap, C = unknown, M = unknown>(
		config: FetchConfig<TDataMap, TKey, C, M>
	): Promise<TDataMap[TKey]> {
		const entry = this.getEntry<TKey, C, M>(
			config.queryKey,
			QueryType.FETCH,
			config.options
		)
		return entry.query(config)
	}

	mutate<TKey extends keyof TDataMap, C = unknown, M = unknown>(
		config: MutateConfig<TDataMap, TKey, C, M>
	): Promise<TDataMap[TKey]> {
		const entry = this.getEntry<TKey, C, M>(
			config.queryKey,
			QueryType.MUTATE,
			config.options
		)
		entry.reset()
		return entry.query(config)
	}

	private getEntry<TKey extends keyof TDataMap, C = unknown, M = unknown>(
		key: QueryKeyFor<TDataMap, TKey>,
		type: QueryType = QueryType.FETCH,
		options?: QueryOptions
	): Query<TDataMap[TKey], C, M> {
		const cacheKey = serializeKey(key)
		let entry = this.cache.get(cacheKey)

		if (entry) return entry as Query<TDataMap[TKey], C, M>

		this.cleanupCache()

		entry = this.newQuery(type, options)
		this.cache.set(cacheKey, entry)

		return entry as Query<TDataMap[TKey], C, M>
	}

	invalidate<TKey extends keyof TDataMap>(
		queryKey: QueryKeyFor<TDataMap, TKey>
	) {
		const cacheKey = serializeKey(queryKey)
		const entry = this.cache.get(cacheKey)

		if (entry) {
			this.cleanupEntry(entry)
			this.cache.delete(cacheKey)
		}
	}

	async refetch<TKey extends keyof TDataMap>(
		queryKey: QueryKeyFor<TDataMap, TKey>,
		queryFn: () => Promise<TDataMap[TKey]>
	) {
		const entry = this.getEntry<TKey>(queryKey, QueryType.FETCH)
		return entry.query({
			queryFn,
			context: entry.lastContext
		})
	}

	clear() {
		for (const entry of this.cache.values()) {
			this.cleanupEntry(entry)
		}
		this.cache.clear()
	}
}
