# Roadmap

---

## 📦 `lery-core` (core package)

### Version **0.3.x** _(Current / Alpha)_

#### Core functionality

- ✅ Request status (idle / loading / success / error)
- ✅ Request cancellation via `AbortController`
- ✅ Refresh‑interval polling
- ✅ Key serialization (`serializeKey`)
- ✅ Cache invalidation
- ✅ Deduplication interval
- ✅ Race‑condition handling
- ✅ Cache size limit
- ✅ Subscription API (`subscribe` / `unsubscribe`)
- ✅ Base TypeScript typings

### Version **0.4.x** _(Next minor)_

#### Enhancements to core

- ✅ Lazy cache cleanup (on‑access eviction)
- ✅ Minimize allocations on state updates
- ✅ Pass `AbortSignal` & `context` into `queryFn`
- ✅ `onSuccess` / `onError` / `onSettled` callbacks

### Version **0.5.x** _(Medium‑term)_

#### Type & performance polish

- ✅ Cache TTL
- ✅ Fully‑strict typings for `QueryKey`, `TKey`, `DataMap`
- ✅ GC & memory optimizations
- ✅ Support for custom `meta` in query configs (plugins)

- ⬜ Some tests and showcase

---

## 🎛️ `lery-react` (UI adapter package)

> _Will be maintained as a separate package; core remains framework‑agnostic._

### Version **0.4.x** _(Post‑core stabilization)_

- ⬜ `useQuery` & `useMutation` hooks
- ⬜ React **Suspense** support
- ⬜ Automatic cancellation on unmount
- ⬜ Optimistic updates via hooks
- ⬜ Integration tips for React Router / TanStack Router
- ⬜ Strict TypeScript typings mapped to `lery-core`
