import { Query } from './Query.ts'
import type {
	CacheKey,
	CacheMap,
	CacheValue,
	DataMap,
	FetchConfig,
	KeyOf,
	LeryConfig,
	MutateConfig,
	QueryState,
	SubscribeConfig,
	Unsubscribe
} from './types'

export class Lery<TDataMap extends DataMap> {
	private cache = new Map<string, Query<any>>()

	constructor(private config?: LeryConfig) {}

	private serializeKey(key: CacheKey<TDataMap>): string {
		return key.join('|')
	}

	private retrieveEntry<TKey extends KeyOf<TDataMap>>(
		key: CacheKey<TDataMap>
	): Query<CacheValue<TDataMap, TKey>> {
		const cacheKey = this.serializeKey(key)

		let entryMap = this.cache as CacheMap<TDataMap, TKey>
		let entry = entryMap.get(cacheKey)

		if (!entry) {
			entry = new Query<CacheValue<TDataMap, TKey>>(this.config)
			entryMap.set(cacheKey, entry)
		}

		return entry
	}

	private invalidate(key: CacheKey<TDataMap>) {
		this.cache.delete(this.serializeKey(key))
	}

	subscribe<TKey extends KeyOf<TDataMap>>(
		config: SubscribeConfig<TDataMap, TKey>
	): Unsubscribe {
		const entry = this.retrieveEntry<TKey>(config.queryKey)

		entry.subscribers.add(config.callback)
		config.callback(entry.getState())

		return () => {
			entry.subscribers.delete(config.callback)
			if (entry.subscribers.size === 0) {
				const entryMap = this.cache as CacheMap<TDataMap, TKey>
				entryMap.delete(this.serializeKey(config.queryKey))
			}
		}
	}

	fetch<TKey extends KeyOf<TDataMap>>(
		config: FetchConfig<TDataMap, TKey>
	): Promise<CacheValue<TDataMap, TKey>> | null {
		const entry = this.retrieveEntry<TKey>(config.queryKey)
		return entry.query(config)
	}

	mutate<TKey extends KeyOf<TDataMap>>(
		config: MutateConfig<TDataMap, TKey>
	): Promise<CacheValue<TDataMap, TKey>> | null {
		const entry = this.retrieveEntry<TKey>(config.queryKey)
		entry.reset()
		return entry.query(config)
	}

	getState<TKey extends KeyOf<TDataMap>>(
		key: CacheKey<TDataMap>
	): QueryState<CacheValue<TDataMap, TKey>> {
		return this.retrieveEntry<TKey>(key).getState()
	}
}
