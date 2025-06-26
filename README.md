# Lery

Lery is a lightweight TypeScript library for managing cached asynchronous data queries, inspired by SWR. It provides a simple API for fetching, caching, and subscribing to data updates, making it ideal for state management in modern web applications.

## Features

- **Lightweight**: Minimal dependencies and small bundle size.
- **TypeScript-first**: Fully typed API for safety and autocompletion.
- **Cache & Subscribe**: Efficiently cache data and subscribe to updates for specific keys.
- **Error & Loading States**: Built-in support for error and loading state management.

## Installation

```sh
npm install lery
```

or with Bun:

```sh
bun add lery
```

## Usage

```typescript
import { Lery } from 'lery'

const query = new Lery()

// Subscribe to a key
const unsubscribe = query.subscribe('user', state => {
	console.log(state.data, state.isLoading, state.error)
})

// Fetch data
query.fetch('user', () => fetch('/api/user').then(res => res.json()))

// Get current state without subscribing
const state = query.getState('user')

// Unsubscribe when done
unsubscribe()
```

## API

### `subscribe<T>(key: string, callback: (state: QueryState<T>) => void): () => void`

Subscribe to updates for a specific cache key. Returns an unsubscribe function.

### `fetch<T>(key: string, fetcher: () => Promise<T>): void`

Fetch data using the provided async function and update the cache.

### `getState<T>(key: string): QueryState<T>`

Get the current state for a cache key (data, error, isLoading).

## Types

- `QueryState<T>`: `{ data: T | null, error: unknown | null, isLoading: boolean }`
- `Subscriber<T>`: `(state: QueryState<T>) => void`

## License

MIT
