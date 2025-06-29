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
- ✅ Fully‑strict typings
- ✅ Memory optimizations
- ✅ **Plugin registration API**

### Version **0.6.x** _(Long‑term)_

- ⬜ **Optimistic updates** (UI‑first mutations)
- ⬜ Some tests and showcase
