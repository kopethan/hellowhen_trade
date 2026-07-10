# PLAN-TIME-SMOKE1 — Plan quick time picker and conflict smoke checklist

Date: 2026-07-09

This checklist covers the Plan date/time UX after:

1. `plan-time-quick-picker-conflict` — quick date, quick time, duration helper, and client-side conflict warning
2. `PLAN-TIME2` — real native date/time picker for mobile custom date/time choices
3. `PLAN-CONFLICT2` — backend 60-minute conflict enforcement

The goal is not to add new product scope. The goal is to confirm Plan creation stays fast, keyboard-light, timezone-safe, and protected by backend conflict checks.

## Product invariant

A user should be able to schedule a Plan with quick controls for normal cases:

```txt
Date: Today / Tomorrow / This weekend / Next week / Custom
Time: Morning / Afternoon / Evening / Custom
Duration: 30 min / 1h / 1h30 / 2h / Custom
```

Custom date/time should use platform-native controls where available:

```txt
Native iOS/Android:
  @react-native-community/datetimepicker

Web:
  browser-native date/time inputs
```

The backend is the final authority for conflicts. The client warning improves UX, but the API must reject invalid Plan time ranges even if a client bypasses the warning.

Current conflict rule:

```txt
An active Plan owned by the same user must not overlap another active owned Plan,
and must keep at least 60 minutes between the previous Plan end and the next Plan start.
```

Exactly 60 minutes is allowed. Less than 60 minutes is blocked.

## Required local commands

Run after applying the Plan time patch stack:

```powershell
npm run build:packages
npx tsc --noEmit -p apps/mobile/tsconfig.json
```

If Prisma binaries are available locally, also run:

```powershell
npm run typecheck
```

Then run the apps against a local API:

```powershell
npm run dev:api
npm run dev:web
npm run dev:mobile
```

For physical mobile devices, configure `apps/mobile/.env` with a real LAN API URL instead of `localhost`.

## Device/browser matrix

Test at least:

- iOS simulator or iPhone through Expo Go / dev client
- Android emulator or Android phone through Expo Go / dev client
- mobile web on Safari or Chrome
- desktop web on Chrome or Safari
- light mode and dark mode
- English and French language settings if available
- logged-in user with no existing Plans
- logged-in user with existing active Plans

## Feature flag setup

Use the same Plans flags required by the existing local Plan flow. For local testing, confirm the Plan create route/screen is visible and that Plan creation is not blocked by first-launch guards.

Common local variables used in recent Plan testing include:

```env
PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS=true
NEXT_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS=true
EXPO_PUBLIC_PLANS_ALLOW_WITH_FIRST_LAUNCH_GUARDS=true
```

If your environment still uses the older visibility/enabled flags, keep those aligned with the existing Plan smoke docs and local setup.

## Web quick date smoke

Open the web Create Plan flow.

- Tap `Today`; confirm the selected date becomes the current local date.
- Tap `Tomorrow`; confirm the selected date becomes tomorrow's local date.
- Tap `This weekend`; confirm the selected date moves to the next weekend date used by the product helper.
- Tap `Next week`; confirm the selected date moves into the next week.
- Tap `Custom`; confirm a browser-native date input is available.
- Pick a custom date and confirm the visible summary updates.
- Switch between presets after choosing Custom and confirm stale custom values do not keep overriding the selected preset.

Regression checks:

- The date field should not require typing for Today, Tomorrow, This weekend, or Next week.
- The selected date should not drift by one day after preview/publish because of timezone conversion.
- Refresh or navigate away/back if draft persistence is supported; confirm the selected date is restored or safely reset according to existing draft rules.

## Web quick time smoke

Open the web Create Plan flow.

- Tap `Morning`; confirm the start time updates to the product's morning preset.
- Tap `Afternoon`; confirm the start time updates to the product's afternoon preset.
- Tap `Evening`; confirm the start time updates to the product's evening preset.
- Tap `Custom`; confirm a browser-native time input is available.
- Pick a custom time and confirm the visible start time summary updates.
- Switch between presets after choosing Custom and confirm stale custom values do not keep overriding the selected preset.

Regression checks:

- Preset time buttons should not open a keyboard.
- Custom time should use the browser-native time field, not a fragile free-text-only field.
- Invalid or empty custom time should not submit a broken Plan range.

## Web duration helper smoke

Open the web Create Plan flow.

- Select `30 min`; confirm the Plan end is start + 30 minutes.
- Select `1h`; confirm the Plan end is start + 1 hour.
- Select `1h30`; confirm the Plan end is start + 1 hour 30 minutes.
- Select `2h`; confirm the Plan end is start + 2 hours.
- Select `Custom`; enter a valid custom duration if supported by the UI.
- Confirm the preview/summary shows a readable start/end range.
- Change the start date/time after choosing a duration and confirm the end time recalculates from the new start.

Regression checks:

- Duration selection should not silently create `endsAt` before `startsAt`.
- Duration changes should trigger the conflict warning again.
- A custom duration of zero, negative, or invalid text should be blocked or ignored safely.

## Native quick date smoke

Open the native Create Plan flow.

- Tap `Today`; confirm the selected date becomes the current local date.
- Tap `Tomorrow`; confirm the selected date becomes tomorrow's local date.
- Tap `This weekend`; confirm the selected date moves to the next weekend date used by the product helper.
- Tap `Next week`; confirm the selected date moves into the next week.
- Tap `Custom`; confirm the native date picker opens.
- Choose a custom date and confirm the visible date summary updates.
- Cancel/dismiss the picker and confirm the previous selected date is preserved.

Regression checks:

- `Custom` should not require typing the date into a keyboard field.
- The picker should work on both iOS and Android.
- Android picker dismissal should not accidentally clear the selected date.
- iOS picker changes should not submit until the user confirms if the UI uses a confirm action.
- Selected dates should not drift by one day after creating the Plan.

## Native quick time smoke

Open the native Create Plan flow.

- Tap `Morning`; confirm the start time updates to the product's morning preset.
- Tap `Afternoon`; confirm the start time updates to the product's afternoon preset.
- Tap `Evening`; confirm the start time updates to the product's evening preset.
- Tap `Custom`; confirm the native time picker opens.
- Choose a custom time and confirm the visible time summary updates.
- Cancel/dismiss the picker and confirm the previous selected time is preserved.

Regression checks:

- `Custom` should not require typing time into the keyboard.
- The picker should work on both iOS and Android.
- Android picker dismissal should not accidentally clear the selected time.
- Switching back to Morning/Afternoon/Evening should close or ignore any stale custom picker state.

## Native duration helper smoke

Open the native Create Plan flow.

- Select `30 min`; confirm the Plan end is start + 30 minutes.
- Select `1h`; confirm the Plan end is start + 1 hour.
- Select `1h30`; confirm the Plan end is start + 1 hour 30 minutes.
- Select `2h`; confirm the Plan end is start + 2 hours.
- Select `Custom`; confirm custom duration behavior is clear and valid values update the end time.
- Change the start date/time after selecting a duration and confirm the end time recalculates.

Regression checks:

- Duration buttons should not open the keyboard.
- Only custom/manual duration should use typing if no native duration picker exists.
- Invalid custom duration should not submit a broken Plan range.

## Native custom end date/time smoke

If the Create Plan flow exposes custom Plan end date/time controls in addition to duration buttons:

- Open custom end date and confirm the native date picker opens.
- Open custom end time and confirm the native time picker opens.
- Pick an end date/time after the start and confirm the summary updates.
- Try an end date/time before the start and confirm the UI blocks or shows validation.
- Cancel/dismiss each picker and confirm previous values are preserved.

## Client-side conflict warning smoke

Use one logged-in user.

Create an existing active Plan:

```txt
Existing Plan A:
  startsAt = 2026-07-20 10:00 local
  endsAt   = 2026-07-20 11:00 local
```

Then start creating another Plan with the same user.

Expected warnings:

```txt
Requested Plan B 10:30–11:30
  => warning shown immediately, because it overlaps Plan A

Requested Plan B 11:30–12:30
  => warning shown immediately, because only 30 minutes separate Plan A end and Plan B start

Requested Plan B 12:00–13:00
  => no warning, because exactly 60 minutes separate Plan A end and Plan B start

Requested Plan B 08:30–09:30
  => warning shown immediately, because only 30 minutes separate Plan B end and Plan A start

Requested Plan B 08:00–09:00
  => no warning, because exactly 60 minutes separate Plan B end and Plan A start
```

Regression checks:

- Changing date, time, duration, or custom end time recalculates the warning immediately.
- The warning disappears after choosing a safe time.
- The warning copy mentions overlap or the 1-hour gap rule.
- The warning should not appear for another user's Plan.
- Cancelled/inactive Plans should not block new active Plans if the backend excludes them.

## Backend create conflict smoke

The API must reject conflicts even if the UI is bypassed.

With existing Plan A:

```txt
Plan A:
  startsAt = 2026-07-20T10:00:00 local/ISO
  endsAt   = 2026-07-20T11:00:00 local/ISO
```

Test `POST /plans` with the same authenticated user:

```txt
Plan B 10:30–11:30
  => reject with error code plan_time_overlap

Plan B 11:30–12:30
  => reject with error code plan_time_overlap

Plan B 12:00–13:00
  => accept

Plan B 08:30–09:30
  => reject with error code plan_time_overlap

Plan B 08:00–09:00
  => accept
```

The conflict response should include enough data for clients to show a useful message:

```txt
code = plan_time_overlap
minGapMinutes = 60
requested range
conflicting Plan summary/range
```

Regression checks:

- A malicious or stale client cannot create overlapping Plans.
- Exactly 60 minutes of separation is accepted.
- Less than 60 minutes is rejected.
- Another user's Plan does not block the current user.
- Cancelled/inactive Plans do not block new Plans if the backend excludes them.

## Backend place add/update conflict smoke

These checks cover routes that can change a Plan's effective time after creation.

Use the same user and two safe Plans:

```txt
Plan A:
  startsAt = 2026-07-20 10:00
  endsAt   = 2026-07-20 11:00

Plan B:
  startsAt = 2026-07-20 12:00
  endsAt   = 2026-07-20 13:00
```

Test `POST /plans/:planId/places`:

- Add or append a timed place to Plan A that extends Plan A beyond 11:00 and leaves less than 60 minutes before Plan B.
- Confirm the API rejects with `plan_time_overlap`.
- Add a timed place that keeps Plan A ending at or before 11:00.
- Confirm the API accepts.

Test `PATCH /plans/:planId/places/:placeId`:

- Update a timed place in Plan A so the Plan range overlaps Plan B or leaves less than 60 minutes before it.
- Confirm the API rejects with `plan_time_overlap`.
- Update the timed place back to a safe range.
- Confirm the API accepts.

Regression checks:

- Place add/update should not accidentally let users bypass the create-time conflict rule.
- The response should keep the same error code used by `POST /plans`.
- Failed place updates should not partially persist the unsafe time.

## Timezone and date-boundary smoke

Use a local timezone device/browser. Europe/Paris is a good default for current testing.

- Create a Plan starting late evening with a `2h` duration and confirm the end date moves to the next calendar day when needed.
- Create a Plan around midnight and confirm the displayed date/time matches the stored range after reload.
- Create a custom date through the native picker and confirm the stored API payload does not shift to the previous or next day.
- Test Today/Tomorrow shortly before midnight if practical.
- Test a date across daylight-saving changes if practical; the app should not crash or create negative durations.

## Keyboard and accessibility smoke

Native:

- Quick date buttons are reachable with screen-reader labels if accessibility tooling is enabled.
- Quick time buttons are reachable with screen-reader labels if accessibility tooling is enabled.
- Native date/time picker opening does not leave a stuck software keyboard on screen.
- Tapping Done/Cancel on picker returns focus to the Plan flow without hiding the main submit action.

Web:

- Date/time controls are keyboard reachable.
- Focus state is visible.
- Error and warning text is close to the affected controls.

## Empty/loading/error states

- With no existing Plans, the conflict section should stay quiet and should not show a fake warning.
- If the existing Plans request fails, the user should see a safe retryable/fallback state if the UI exposes one.
- A failed conflict lookup should not be treated as permission to bypass backend validation.
- If the backend rejects with `plan_time_overlap`, both web and native should show a clear user-facing error.

## Non-goals

Do not add these as part of this smoke patch:

```txt
new calendar/agenda feature
shared booking system
Google Calendar sync
Apple Calendar sync
push reminders
background conflict monitoring
new payment/membership behavior
new Place address provider behavior
```

This checklist only verifies Plan date/time selection, duration helpers, native date/time pickers, and backend conflict enforcement.
