# Lery

**Lery** is a tiny, strongly-typed async state manager for TypeScript.
Inspired by TanStack Query, but implemented from scratch with **zero dependencies** and a minimal API.

---

## ✨ Features

- 🔁 Cache data by key
- 🔔 Subscribe to updates
- 📦 Track loading status (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`, `REFETCHING`)
- ⚡️ Simple API: `fetch`, `subscribe`, `getState`
- 🔒 Fully type-safe with generic support

---

## 📦 Installation

```bash
bun add lery
# or
npm install lery
# or
pnpm add lery
```

---

## 🚀 Quick Start

```ts
import { Lery } from 'lery'

type User = { id: string; name: string }

type API = {
	user: User
}

const lery = new Lery<API>()

// Subscribe to state changes
const unsubscribe = lery.subscribe(['user'], state => {
	if (state.isLoading) console.log('Loading...')
	if (state.isError) console.log('Error')
	if (state.isSuccess) console.log('Success\n', state.data)
})

// Fetch user data
const response = await lery.fetch(['user'], async () => {
	const res = await fetch('/api/user')
	// You can use zod or json schema
	return res.json() as Promise<User>
})
```

---

## 🧩 API

### `new Lery<TDataMap>(options?)`

Creates a new Lery instance.

- `TDataMap` maps keys to their response types.
- `options` (optional): `{ dedupingTime?: number }` — global deduplication time in ms.

---

### `fetch(key, fetcher, fetchOptions?)`

Triggers an async fetch and updates state for the given key.

- **key**: array key, e.g. `['user']` or `['post', 1]`
- **fetcher**: function returning a `Promise<...>`
- **fetchOptions** (optional): `{ dedupingTime?: number }` — deduplication time for this fetch

Returns a `Promise` with the result, or `null` if deduplication is active.

---

### `subscribe(key, callback): () => void`

Subscribes to state changes for a given key.

- **key**: array key, e.g. `['user']`
- **callback**: function called on every state change

The callback is called immediately with the current state.  
Returns an unsubscribe function. If there are no subscribers left, the cache is cleared.

---

### `getState(key)`

Returns the current state for a given key without subscribing.

- **key**: array key, e.g. `['user']`

---

## 🧠 Types

```ts
type QueryState<T> = {
	data: T | null
	error: unknown | null
	status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' | 'REFETCHING'
	isIdle: boolean
	isLoading: boolean
	isFetching: boolean
	isSuccess: boolean
	isError: boolean
	isFetched: boolean
}
```

---

## 📜 License

MIT — free to use, modify, and distribute.
