# Plan Weather — mobile temperature display

PLAN-WEATHER2 adds a compact forecast temperature to eligible offline Plan Place cards on mobile. Weather remains a secondary metadata signal, not a full weather surface.

## Display rules

- Only authenticated users can receive Plan Place weather from the existing Plan-scoped endpoint.
- The mobile precheck requires the Plan Place itself to be local and to have its own `startsAt` within the next seven days.
- The client never substitutes the parent Plan `startsAt` for weather eligibility.
- Starter Plan ideas and the create-Plan preview never make weather requests.
- Provider failures, missing credentials, unavailable forecasts, malformed payloads, or missing attribution silently leave the existing Place card unchanged.
- No device GPS or location permission is requested for weather. The server uses the stored Plan Place target coordinates established in PLAN-WEATHER1B.

## Temperature units

Celsius is the default display unit. Tapping the compact temperature badge switches between Celsius and Fahrenheit. The selection is stored locally on the device and shared across Plan Place cards; it does not alter server data or the canonical Celsius forecast value.

## WeatherKit attribution

Apple Weather data is displayed only after the official WeatherKit attribution mark has loaded successfully. The server returns:

- the localized Apple Weather service name,
- the legal attribution URL from forecast metadata,
- official light and dark WeatherKit logo asset URLs from the WeatherKit attribution endpoint.

The mobile card renders the official mark with a Sources link that opens Apple's legal attribution page. If the required attribution payload or mark is unavailable, the temperature stays hidden.

## Deferred

This patch does not add current conditions, rain probability, condition icons, alerts, a full weather widget, Explore Place weather, or weather to remote Plan Places.
