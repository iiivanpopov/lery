import { QueryEntry } from './QueryEntry'
import { type QueryState, type Subscriber } from './types'

export class Lery<TQueries extends Record<string, any> = any> {
	private cache = new Map<keyof TQueries, QueryEntry<any>>()

	subscribe<K extends keyof TQueries>(
		key: K,
		callback: Subscriber<TQueries[K]>
	): () => void {
		let entry = this.cache.get(key) as QueryEntry<TQueries[K]> | undefined
		if (!entry) {
			entry = new QueryEntry<TQueries[K]>()
			this.cache.set(key, entry)
		}

		entry.subscribers.add(callback)
		callback(entry.getState())

		return () => {
			entry!.subscribers.delete(callback)
			if (entry!.subscribers.size === 0) {
				this.cache.delete(key)
			}
		}
	}

	fetch<K extends keyof TQueries>(
		key: K,
		fetcher: () => Promise<TQueries[K]>
	): void {
		let entry = this.cache.get(key) as QueryEntry<TQueries[K]> | undefined
		if (!entry) {
			entry = new QueryEntry<TQueries[K]>()
			this.cache.set(key, entry)
		}

		entry.begin()

		fetcher()
			.then(data => entry!.succeed(data))
			.catch(err => entry!.fail(err))
	}

	getState<K extends keyof TQueries>(key: K): QueryState<TQueries[K]> {
		const entry = this.cache.get(key) as QueryEntry<TQueries[K]> | undefined
		if (!entry) {
			const newEntry = new QueryEntry<TQueries[K]>()
			this.cache.set(key, newEntry)
			return newEntry.getState()
		}
		return entry.getState()
	}
}
