# Sports Planner

Sports Planner is the Personal OS schedule and calendar-export mini app at `/sports`.
It stores normalized sports data in the existing Prisma/SQLite database and supports
football, basketball, and padel in one sport → competition → event model.

## Data providers and coverage

The live adapter uses TheSportsDB v1 with its documented public key `123`. No signup,
secret, or user-entered API key is required. Its free tier supplies football and
basketball competition/event data, allows 30 requests per minute, and limits the
number of records returned by some endpoints. The adapter therefore:

- Builds the catalog from a centralized set of useful countries.
- Uses date-based schedule queries for a bounded upcoming window.
- Supports on-demand refreshes for a selected competition.
- Persists discovered competitions, so the selector is not derived only from visible events.
- Keeps provider-specific payloads out of the UI.

Football includes domestic leagues and cups where the provider exposes them, plus
continental/international competitions discovered by the catalog and event feed.
Basketball is not NBA-only; NBA is a default preference alongside other major leagues.

No stable, structured, free, server-accessible padel match feed survived validation
at implementation time. Padel remains fully represented in the data model, filters,
statuses, time semantics, calendar logic, and provider interface. The production UI
clearly reports that live padel schedules are unavailable and never fabricates matches.
Add a provider adapter implementing `SportsScheduleProvider` to activate it.

## On-demand cache flow

Sports schedules are refreshed on demand when Sports Planner is opened, when the user
manually refreshes, or when a selected competition requires fresh data. No scheduled
background task is used.

The first `GET /api/sports/events` reads only the database. Fresh data is returned
without a provider call. Stale data is rendered immediately and the browser then calls
`POST /api/sports/refresh`. A persistent top-right toast remains visible while the
request runs. The page re-fetches stored data after success and preserves cached data
after failure.

Refresh scopes are:

- `all-supported`
- `football`, `basketball`, or `padel`
- `<sport>:competition:<provider-id>`

`SportsSyncState` records last attempt, last success, status, errors, and an expiring
database lock per scope. Lock acquisition uses an atomic conditional database update,
so duplicate tabs and repeated clicks do not launch duplicate provider requests.
Freshness always uses `lastSuccessAt`; failures never make data appear fresh.

## Configuration

All variables have working defaults:

```env
SPORTS_API_BASE_URL="https://www.thesportsdb.com/api/v1/json/123"
SPORTS_EVENTS_REFRESH_TTL_MINUTES="60"
SPORTS_COMPETITIONS_REFRESH_TTL_HOURS="24"
SPORTS_REFRESH_LOCK_MINUTES="5"
SPORTS_MANUAL_REFRESH_COOLDOWN_SECONDS="60"
SPORTS_UPCOMING_WINDOW_DAYS="7"
SPORTS_PAST_RETENTION_DAYS="2"
```

The free provider limit makes seven days the safe default ingestion window. It can be
increased up to 30 days when a provider with suitable limits is configured.

TheSportsDB requests for today and tomorrow always use live responses. Days three through
seven use a six-hour server cache because those fixtures change less often; manual refreshes
bypass that cache. This lowers a normal two-sport automatic refresh from 14 daily schedule
requests to about four once the future-day cache is warm.

Apply migrations with `npm run db:migrate` and regenerate the client with
`npm run prisma:generate`.

## Time and calendars

Timestamps are stored in UTC. The browser's IANA timezone is detected on first use and
persisted in `SportsPreference`; `Intl.DateTimeFormat` handles conversion and daylight
saving rules. Today, Tomorrow, grouping, event details, and exports use the selected
timezone.

Eligible events open prefilled Google Calendar or Outlook Calendar compose pages in a
new tab. Opening a compose page is not reported as a saved calendar event. Multiple
selected events export as one escaped `.ics` file with stable UIDs. Central fallback
durations are football 2 hours, basketball 2.5 hours, and padel 2.5 hours.

Events without a usable time cannot open calendar compose pages. Estimated padel
schedules include an explicit warning in the calendar description.

## Preferences and extension

The default profile persists preferred sports, preferred competition IDs, preferred/all
mode, last selections, and timezone. Default competition patterns and catalog countries
are centralized in `src/features/sports/config.ts`.

To add a sport, extend the `sports` list and duration map, then add provider normalization
and sport-aware labels. To add a provider, implement `SportsScheduleProvider`, normalize
its payloads into `NormalizedCompetition` and `NormalizedEvent`, and route refresh scopes
through it. Provider credentials, if ever required, must remain server-side.

Sports Planner does not provide custom reminders or notifications. Reminder behavior is
managed by Google Calendar, Outlook Calendar, or another calendar application after an
event is added.

## Known limitations

- TheSportsDB free responses are intentionally capped, so coverage is broad but not exhaustive.
- NBA coverage is discovered from ESPN's Uruguay league directory on every refresh. The primary
  NBA feed and every current `nba-summer-*` feed are fetched and identity-checked, so newly listed
  Summer League schedules do not require another hardcoded slug.
- Uruguayan Primera Division is fetched from ESPN's dedicated `uru.1` feed in addition to the
  worldwide TheSportsDB query. If a required ESPN feed fails or changes identity, the refresh is
  marked partial and the UI warns that some schedule sources need attention while retaining cache.
- FotMob's public Uruguay TV guide is used as a corroborating football source. When a provider
  supplies a shifted placeholder but the regional guide supplies a confirmed kickoff, Personal OS
  keeps one event, uses the confirmed schedule, and merges the Uruguay broadcast services. The
  aggregate country guide supplies every channel in one request instead of querying each platform.
- Verified regional rights add Disney+ Premium to Liga AUF Uruguaya, Formula 1, and supported
  Premier Padel events, and Paramount+ to UFC. Other events receive a badge only when a schedule
  or TV-guide source identifies one of the configured services; unknown rights are not guessed.
- Streaming badges are derived automatically from broadcaster names supplied by each schedule
  provider. ESPN channels map to Disney+ Premium in Uruguay. DAZN is shown only when the source
  explicitly identifies free or freemium access, and YouTube TV or paid YouTube listings are
  excluded. A missing badge means the provider did not supply enough reliable information, not
  that the event is unavailable everywhere.
- The app is currently single-profile because Personal OS has no authentication/user model.
- Data does not refresh while nobody uses Sports Planner.
- Automatic refreshes reuse ESPN's NBA league directory for six hours. Formula 1 is refreshed every
  12 hours, while boxing and UFC are refreshed every four hours; their schedules change much less
  often than match feeds. A manual Refresh bypasses these source TTLs, with a one-minute cooldown
  that absorbs double clicks and immediate retries without making another provider request.
- SQLite locking is distributed-safe for processes sharing this database file; a future
  multi-host deployment should use a shared database with the same conditional lock design.
