import { QueryEntry } from './QueryEntry'
import type {
	FetchOptions,
	KeyOf,
	LeryOptions,
	QueryKeyOf,
	QueryState,
	Subscriber,
} from './types'

export class Lery<TDataMap extends Record<string, unknown>> {
	private cache = new Map<string, QueryEntry<any>>()

	constructor(private options?: LeryOptions) {}

	private serializeKey(key: QueryKeyOf<TDataMap>): string {
		return key.join('|')
	}

	private retrieveEntry<TKey extends KeyOf<TDataMap>>(
		key: QueryKeyOf<TDataMap>
	): QueryEntry<TDataMap[TKey]> {
		const cacheKey = this.serializeKey(key)
		let entry = this.cache.get(cacheKey) as
			| QueryEntry<TDataMap[TKey]>
			| undefined

		if (!entry) {
			entry = new QueryEntry<TDataMap[TKey]>(this.options)
			this.cache.set(cacheKey, entry)
		}

		return entry
	}

	subscribe<TKey extends KeyOf<TDataMap>>(
		key: QueryKeyOf<TDataMap>,
		callback: Subscriber<TDataMap[TKey]>
	): () => void {
		const entry = this.retrieveEntry<TKey>(key)
		entry.subscribers.add(callback)
		callback(entry.getState())

		return () => {
			entry.subscribers.delete(callback)
			if (entry.subscribers.size === 0) {
				this.cache.delete(this.serializeKey(key))
			}
		}
	}

	fetch<TKey extends KeyOf<TDataMap>>(
		key: QueryKeyOf<TDataMap>,
		fetcher: () => Promise<TDataMap[TKey]>,
		fetchOptions?: FetchOptions
	): Promise<TDataMap[TKey]> | null {
		return this.retrieveEntry<TKey>(key).fetch(fetcher, fetchOptions)
	}

	getState<TKey extends KeyOf<TDataMap>>(
		key: QueryKeyOf<TDataMap>
	): QueryState<TDataMap[TKey]> {
		return this.retrieveEntry<TKey>(key).getState()
	}
}
