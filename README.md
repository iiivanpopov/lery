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

### `new Lery<TQueries>()`

Creates a new instance of the Lery store.
`TQueries` maps keys to their corresponding response types.

---

### `fetch<K>(key: K, fetcher: () => Promise<TQueries[K]>)`

Triggers an async fetch and updates state for the given key.

---

### `subscribe<K>(key: K, callback: (state: QueryState<TQueries[K]>) => void): () => void`

Subscribes to state changes for a given key.
The callback is called immediately with the current state and again whenever it updates.
Returns an `unsubscribe` function.

---

### `getState<K>(key: K): QueryState<TQueries[K]>`

Returns the current state for a given key without subscribing.

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

## 🧪 Testing

Using [Bun](https://bun.sh/):

```bash
bun test
```

---

## 📁 Project Structure

```
src/
├── Lery.ts         // Public API and query manager
├── QueryEntry.ts   // Internal cache unit per key
├── types.ts        // Status enums and type definitions
```

---

## 📜 License

MIT — free to use, modify, and distribute.
