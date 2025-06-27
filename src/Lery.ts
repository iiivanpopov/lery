import { Query } from './QueryEntry'
import type {
	CacheKey,
	CacheMap,
	CacheValue,
	DataMap,
	FetchConfig,
	KeyOf,
	LeryConfig,
	QueryState,
	SubscribeConfig,
	Unsubscribe,
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
		return entry.fetch(config)
	}

	getState<TKey extends KeyOf<TDataMap>>(
		key: CacheKey<TDataMap>
	): QueryState<CacheValue<TDataMap, TKey>> {
		return this.retrieveEntry<TKey>(key).getState()
	}
}
