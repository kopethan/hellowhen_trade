# Plan Place weather lookup

PLAN-WEATHER1B connects the server-only weather foundation to real Plan Places without adding mobile UI or a database migration.

## Endpoint

Authenticated clients may request:

```text
GET /plans/:planId/places/:planPlaceId/weather
```

The route is mounted behind the existing Plans feature gate and mirrors the current Plan visibility rules. A blocked relationship or an unreadable/deleted Plan returns `404`, so the route does not become an ownership or visibility oracle.

The response is either:

```json
{ "weather": null }
```

or compact scheduled weather metadata containing the Celsius temperature, the matched provider hour, the Plan Place scheduled time, provider identity, fetch time, and the provider-attribution requirement. Coordinates are never returned.

## Eligibility

Weather is looked up only when the requested Plan Place:

- is local/offline (`mode=local`);
- has its own valid `startsAt` value;
- starts now or within the next seven days;
- has stored coordinates on the Plan Place snapshot, or on its reusable source Place as a compatibility fallback; and
- has a WeatherKit hourly point close enough to the Plan Place's own scheduled time.

The parent Plan `startsAt` is deliberately not accepted by the lookup helper and is never used as a fallback.
Remote Places, missing dates, missing/invalid coordinates, past dates, dates outside the seven-day horizon, disabled weather, provider failures, and missing nearby forecast points all return `weather: null`.

## Privacy and provider boundary

The client supplies only Plan and Plan Place IDs. It cannot submit arbitrary latitude/longitude values to proxy WeatherKit through Hellowhen. The API resolves stored coordinates after Plan visibility checks, calls the server-only weather service, and strips coordinates from the returned weather snapshot.

PLAN-WEATHER2 may consume this endpoint for the compact mobile temperature treatment and temperature-unit preference. It must also render the required Apple Weather attribution/legal affordance when weather is visible.
