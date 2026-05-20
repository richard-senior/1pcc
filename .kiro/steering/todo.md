# 1PCC Improvement Backlog

Context: LAN-only game, security not a concern. Priorities are stability, player experience, and fun.

## High Priority

### 1. Strip sensitive data from game state response — DONE
- Non-admin users now get a sanitised copy: future questions have `correctAnswers` nil'd and `hostAnswer` emptied
- Current question's answers are URL-safe base64 encoded while active, plaintext once timed out
- Client-side `decodeB64()` in `GameAPI.fetchGameState()` decodes transparently before scoring code runs
- Admin/host always gets full plaintext state
- Files modified: `internal/handlers/api.go`, `static/js/GameAPI.js`

### 2. Override answer username server-side
- `handleSubmitAnswer` trusts the `username` field from the JSON body
- Should pull username from session instead
- Files: `internal/handlers/api.go`

### 3. Add admin guards to host-only endpoints
- `handleNextQuestion`, `handlePreviousQuestion`, `handleStartQuestion`, `handlePauseQuestion`, `handleStopQuestion`, `handleShowAnswer` have no auth check
- Any player can call these. Add `isAdmin` check (same pattern as `handlePlayers`)
- Files: `internal/handlers/api.go`

### 4. Move state mutation to a background ticker
- `decorateGameState` is called on every `GetGame()` poll — mutates timers, scores, message durations
- With N players polling every 2s, state mutates unpredictably and has race conditions
- Replace with a single goroutine ticking every 1s; `GetGame()` becomes a pure read
- Files: `internal/game/game.go`, `cmd/main.go`

### 5. Fix duplicate `cq.IsTimedOut = true` assignments
- Set twice in succession in `decorateGameState` (two locations)
- Files: `internal/game/game.go`

## Medium Priority

### 6. Fix player rejoin flow
- Player navigates away, returns to `/join`, gets "Username already taken"
- If session cookie still valid: redirect straight to `/play`
- If cookie gone but username exists from same IP: allow re-login to existing username
- Files: `internal/handlers/join.go`, `internal/session/session.go`

### 7. Remove full page reload on question change/timeout
- `GameAPI.js` constructor registers listeners that call `window.location.reload(true)`
- Causes flicker, potential missed question starts, and unnecessary network traffic
- The `PageElement.update()` pattern already supports in-place DOM updates — use it
- Files: `static/js/GameAPI.js`

### 8. Add reconnection resilience
- Brief Wi-Fi dropouts increment `failureCount` and eventually kill polling
- Show a "Reconnecting..." overlay instead of silently stopping
- Use exponential backoff on failures, auto-resume on success
- Files: `static/js/GameAPI.js`

## Lower Priority

### 9. Soft kick vs hard kick
- Current `EjectByUsername` destroys the session — player must re-enter username
- Add a "soft kick" that redirects to a "You've been kicked — click to rejoin" page
- Keep current `Ban` for permanent removal
- Files: `internal/session/session.go`, `internal/handlers/api.go`

### 10. WebSockets instead of polling
- 2-second polling lag between host actions and player display
- Replace with WebSocket or SSE for instant state push
- Biggest single UX improvement possible
- Files: `cmd/main.go`, `internal/handlers/` (new ws handler), `static/js/GameAPI.js`

### 11. Replace synchronous XHR
- `GameAPI.sendHttpRequest` and `getFileContent` use synchronous `XMLHttpRequest`
- Blocks UI thread on slow devices. Replace with `fetch`/`await`
- Files: `static/js/GameAPI.js`

### 12. Remove dead code
- `showServerUnavailablePage` returns immediately (`if (1==1) {return;}`)
- Either implement as a reconnection overlay or delete
- Files: `static/js/GameAPI.js`

### 13. Remove redundant question loading in NewGameState
- `NewGameState()` reads `questions.json` but `GetGame()` immediately overwrites it
- Files: `internal/game/game.go`

### 14. Remove dead `isPublicPath` map
- Package-level `publicPaths` map is unused; the function version is what's actually called
- Files: `cmd/main.go`

## Build / Tooling

### 15. Add unit tests
- No `_test.go` files exist. Scoring, timing, kiosk state machine need coverage
- Run with `go test -race` to catch concurrency issues
- Files: `internal/game/game_test.go` (new)

### 16. Gitignore the compiled binary
- `1pcc` (6MB) is committed to the repo
- Files: `.gitignore`

### 17. Consider esbuild for JS bundling
- Current shell-based concatenation works but produces no source maps
- Makes debugging `main.js` errors painful (as noted in README)
- esbuild is zero-config and fast, produces source maps
- Files: `functions.sh`, `package.json` (new)
