# Plan weather provider foundation

PLAN-WEATHER1A adds a server-only, provider-neutral hourly weather foundation for future Plan Place weather.
It does not expose a public weather endpoint and does not change mobile UI, Plan/Place schema, or location permissions.

## Runtime defaults

Weather is off until explicitly configured on the API host:

```env
WEATHER_ENABLED=false
WEATHER_PROVIDER=none
WEATHER_REQUEST_TIMEOUT_MS=4500
WEATHER_CACHE_TTL_SECONDS=900
WEATHER_CACHE_MAX_ENTRIES=500

WEATHERKIT_TEAM_ID=
WEATHERKIT_SERVICE_ID=
WEATHERKIT_KEY_ID=
WEATHERKIT_PRIVATE_KEY=
```

All WeatherKit values are backend secrets. Do not create `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` equivalents.
`WEATHERKIT_PRIVATE_KEY` accepts a normal multiline PEM value or a deployment-secret value containing escaped `\\n` newlines.

To enable the provider later, configure all four WeatherKit values, set `WEATHER_PROVIDER=weatherkit`, and then set `WEATHER_ENABLED=true`.
The factory validates enabled configuration before creating a live provider.

## Data and cache policy

- Hellowhen requests only `forecastHourly`.
- The service requests at most the next seven days even though the provider may support a longer forecast.
- Provider temperatures are normalized to Celsius. Fahrenheit is derived locally when needed.
- Forecasts are cached only in bounded process memory and expire after 15 minutes by default.
- Forecast data is not written to Prisma or used as a historical weather database.
- Concurrent identical lookups share one in-flight provider request.
- Provider errors, timeouts, missing data, invalid coordinates, and disabled configuration return no weather instead of breaking Plan loading.
- Apple Weather attribution is marked as required so PLAN-WEATHER2 can render the required attribution/legal affordance when weather becomes visible.

## Intended next integration

PLAN-WEATHER1B should call this service only after resolving a real Plan Place that is:

- offline/local;
- backed by stored Place coordinates;
- scheduled with that Plan Place's own `startsAt`; and
- within Hellowhen's next-seven-days weather horizon.

It must not fall back to the parent Plan `startsAt`, must not request the user's current GPS position, and must not expose an arbitrary-coordinate weather proxy.
