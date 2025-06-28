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
	private cleanupTimer: NodeJS.Timeout | null = null
	readonly stopCleanup: () => void

	constructor(private config: LeryConfig = {}) {
		this.stopCleanup = this.setupCleanup()
	}

	private setupCleanup() {
		const ttl = this.config.options?.cacheTTL ?? 180000
		this.cleanupTimer = setInterval(() => this.cleanup(), ttl)
		return () => {
			if (!this.cleanupTimer) return

			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
	}

	private cleanup() {
		const now = Date.now()
		const toDelete: number[] = []

		for (const [key, entry] of this.cache) {
			const shouldDelete =
				now >= entry.lastFetchTime + entry.cacheTTL ||
				(entry.subscribers.size === 0 && this.isEntryStale(entry))

			if (shouldDelete) toDelete.push(key)
		}

		toDelete.forEach(key => {
			const entry = this.cache.get(key)
			if (entry) {
				this.cleanupEntry(entry)
				this.cache.delete(key)
			}
		})
	}

	private isEntryStale(entry: Query<any>): boolean {
		const now = Date.now()
		const staleTime = this.config.options?.staleTime ?? 0
		return now >= entry.lastFetchTime + staleTime
	}

	private cleanupEntry(entry: Query<any>) {
		entry.cancel()
		entry.reset()
	}

	private getEntry<TKey extends KeyOf<TDataMap>>(
		key: CacheKey<TDataMap>,
		type: QueryType = QueryType.FETCH,
		options?: QueryOptions
	) {
		const cacheKey = serializeKey(key)
		let entry = this.cache.get(cacheKey)

		if (entry) {
			return entry as Query<CacheValue<TDataMap, TKey>>
		}

		this.cleanupCache()

		entry = this.newQuery(type, options)
		this.cache.set(cacheKey, entry)

		return entry as Query<CacheValue<TDataMap, TKey>>
	}

	private cleanupCache() {
		const maxSize = this.config.options?.maxCacheSize ?? 100
		if (this.cache.size <= maxSize) return

		const entriesToDelete: [number, Query<any>][] = []

		for (const [key, entry] of this.cache) {
			if (entry.subscribers.size === 0) {
				entriesToDelete.push([key, entry])
			}
		}

		entriesToDelete.sort(([, a], [, b]) => a.lastFetchTime - b.lastFetchTime)

		const toDelete = Math.max(0, this.cache.size - maxSize)
		const deleteCount = Math.min(toDelete, entriesToDelete.length)

		for (let i = 0; i < deleteCount; i++) {
			const entry = entriesToDelete[i]
			if (!entry) continue

			const [key, queryEntry] = entry
			this.cleanupEntry(queryEntry)
			this.cache.delete(key)
		}

		if (this.cache.size > maxSize) {
			const allEntries: [number, Query<any>][] = []
			for (const [key, entry] of this.cache) {
				allEntries.push([key, entry])
			}

			allEntries.sort(([, a], [, b]) => a.lastFetchTime - b.lastFetchTime)

			const remaining = this.cache.size - maxSize
			for (let i = 0; i < remaining; i++) {
				const entry = allEntries[i]
				if (!entry) continue

				const [key, queryEntry] = entry
				this.cleanupEntry(queryEntry)
				this.cache.delete(key)
			}
		}
	}

	private newQuery(type: QueryType, options?: QueryOptions) {
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

	subscribe<TKey extends KeyOf<TDataMap>>({
		queryKey,
		callback
	}: SubscribeConfig<TDataMap, TKey>): () => void {
		const entry = this.getEntry<TKey>(queryKey)

		const unsubscribe = entry.subscribe(callback)

		callback(entry.state)

		return () => {
			unsubscribe()
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

	invalidate(queryKey: CacheKey<TDataMap>) {
		const cacheKey = serializeKey(queryKey)
		const entry = this.cache.get(cacheKey)

		if (entry) {
			this.cleanupEntry(entry)
			this.cache.delete(cacheKey)
		}
	}

	async refetch<TKey extends KeyOf<TDataMap>>(
		queryKey: CacheKey<TDataMap>,
		queryFn: () => Promise<CacheValue<TDataMap, TKey>>
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
			if (entry.subscribers.size > 0) {
				activeQueries++
			}
			totalSubscribers += entry.subscribers.size
		}

		return {
			totalEntries: this.cache.size,
			activeQueries,
			totalSubscribers
		}
	}
}
