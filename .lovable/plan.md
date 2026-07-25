## Diagnosis

DB is not the bottleneck — the slowest query in the whole project runs in ~13 ms (checked via slow-query stats). The slowness is on the client:

1. **QueryClient has no defaults.** In `src/router.tsx`, `new QueryClient()` is created with no options, so every query has `staleTime: 0` and `refetchOnWindowFocus: true`. Every time you switch tabs, click back into the window, or navigate between pages, all queries refire — even ones that just returned the same data a second ago. On the dashboard that means all 10 finance/attendance queries run again on every focus.
2. **No cache across navigation.** Because of the above, going Students → Dashboard → Students refetches the student list every time instead of showing the cached result while revalidating.
3. **Heavy chart library loads on the dashboard eagerly.** `recharts` is imported statically at the top of `dashboard.tsx`, so it's parsed even when the user is on another page and it delays the dashboard's first paint.

## What to change

### 1. Add sensible React Query defaults (biggest win)

In `src/router.tsx`, configure the `QueryClient` with:

- `staleTime: 60_000` (1 minute) — most dashboard/list data doesn't need to refetch more than once a minute.
- `gcTime: 5 * 60_000` — keep cached results for 5 minutes so back-navigation is instant.
- `refetchOnWindowFocus: false` — stop the "everything reloads when I click back into the tab" behavior.
- `retry: 1` — a single failed request currently retries 3 times with backoff, which makes transient errors feel like 10-second hangs.

Result: navigating between pages you've already visited becomes instant, and alt-tabbing back into the app no longer triggers a wave of requests.

### 2. Lazy-load Recharts on the dashboard

Split the two charts on `src/routes/_authenticated/dashboard.tsx` into a separate component imported with `React.lazy` + `Suspense`, so the KPI cards render immediately and the charts stream in after. Recharts is one of the largest deps in the bundle.

### 3. Keep the earlier dashboard fix

The 6-month range consolidation from the previous turn stays — it already cut the dashboard from ~21 sequential queries to ~10 parallel ones.

## Not changing

- Database schema, RLS, or indexes — DB timings are already sub-15 ms, so adding indexes wouldn't help.
- Auth flow / layout — the sidebar/layout mounts once and doesn't re-run on child navigation.

## Technical notes

- `defaultPreloadStaleTime: 0` in the router stays as-is (correct for TanStack Query integration).
- Query defaults go on `defaultOptions.queries` when constructing `QueryClient`.
- Lazy chart component will live at `src/components/dashboard/FinanceCharts.tsx` and receive the `monthly` array as a prop.

## Expected outcome

- First visit to dashboard: same speed or slightly faster (charts stream in).
- Repeat visits and tab-switching: near-instant instead of full reload.
- Transient network blips: recover in ~1 s instead of ~7 s.
