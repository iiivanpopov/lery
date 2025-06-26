import type { CacheEntry, QueryState, Subscriber } from './types'

export class Lery {
	private cache: Map<string, CacheEntry<unknown>>

	constructor() {
		this.cache = new Map()
	}

	/**
	 * Subscribes to updates for a specific key. The callback is called immediately with the current state and on every state change.
	 *
	 * @template T The type of the data being cached.
	 * @param {string} key - The cache key to subscribe to.
	 * @param {Subscriber<T>} callback - Function to call with the current state whenever it changes.
	 * @returns {() => void} Unsubscribe function to remove the callback from subscribers.
	 */
	subscribe<T>(key: string, callback: Subscriber<T>): () => void {
		if (!this.cache.has(key)) {
			this.cache.set(key, {
				data: null,
				error: null,
				isLoading: false,
				subscribers: new Set(),
			})
		}

		const entry = this.cache.get(key) as CacheEntry<T> | undefined
		if (!entry) {
			throw new Error(`Cache entry for key "${key}" does not exist.`)
		}
		entry.subscribers.add(callback)

		callback(this._getState<T>(key))

		return () => {
			entry.subscribers.delete(callback)
			if (
				entry.subscribers.size === 0 &&
				entry.data === null &&
				entry.error === null &&
				!entry.isLoading
			) {
				this.cache.delete(key)
			}
		}
	}

	/**
	 * Returns the current state for a given key without subscribing to updates.
	 *
	 * @template T The type of the data being cached.
	 * @param {string} key - The cache key to retrieve state for.
	 * @returns {QueryState<T>} The current state for the key.
	 */
	getState<T>(key: string): QueryState<T> {
		return this._getState<T>(key)
	}

	/**
	 * Internal method to get the current state for a key.
	 *
	 * @template T The type of the data being cached.
	 * @param {string} key - The cache key to retrieve state for.
	 * @returns {QueryState<T>} The current state for the key.
	 * @private
	 */
	private _getState<T>(key: string): QueryState<T> {
		const entry = this.cache.get(key) as CacheEntry<T> | undefined
		if (!entry) {
			return { data: null, error: null, isLoading: false }
		}
		const { data, error, isLoading } = entry
		return { data, error, isLoading }
	}

	/**
	 * Notifies all subscribers of a key with the latest state.
	 *
	 * @template T The type of the data being cached.
	 * @param {string} key - The cache key whose subscribers should be notified.
	 * @private
	 */
	private _notify<T>(key: string): void {
		const entry = this.cache.get(key) as CacheEntry<T> | undefined
		if (!entry) return
		for (const cb of entry.subscribers) {
			cb(this._getState<T>(key))
		}
	}

	/**
	 * Fetches data using the provided fetcher function and updates the cache. Notifies subscribers on state changes.
	 *
	 * @template T The type of the data being fetched.
	 * @param {string} key - The cache key to update.
	 * @param {() => Promise<T>} fetcher - Function that returns a promise resolving to the data.
	 * @returns {void}
	 */
	fetch<T>(key: string, fetcher: () => Promise<T>): void {
		if (!this.cache.has(key)) {
			this.cache.set(key, {
				data: null,
				error: null,
				isLoading: false,
				subscribers: new Set(),
			})
		}
		const entry = this.cache.get(key)! as CacheEntry<T>

		if (entry.isLoading) return

		entry.isLoading = true
		entry.error = null
		this._notify<T>(key)

		fetcher()
			.then(data => {
				entry.data = data
				entry.error = null
			})
			.catch(error => {
				entry.error = error instanceof Error ? error : new Error(String(error))
				entry.data = null
			})
			.finally(() => {
				entry.isLoading = false
				this._notify<T>(key)
			})
	}
}
