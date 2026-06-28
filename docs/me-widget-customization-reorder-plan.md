# ME-WIDGET5 — Me widget customization and reorder plan

## Status

Planning only. Do not implement persistence, drag-and-drop, or user-facing section hiding until this plan is explicitly approved.

## Product goal

The Me hub should become a personal control room that users can lightly shape around how they use Hellowhen.

The first customization version should let users change the order and visibility of sections inside Me without changing the main navigation.

Fixed main navigation stays:

```txt
Plans · Me · Trade
```

Customizable Me content can later include:

```txt
Today
Needs attention
Quick create
Activity
Plans
Tools
Saved & Agenda
Settings & safety
```

## Design principles

- Keep Me calm and social, not admin-like.
- Customize sections, not every tiny row, in the first version.
- Never make Settings & safety hard to find.
- Never allow the main navigation order to change in this phase.
- Keep the default order excellent so customization is optional.
- Make reset-to-default obvious.
- Respect mobile first: customization must work without precise drag gestures.

## Non-goals for the first implementation

Do not implement these in the first customization patch:

- Custom main navigation order.
- Full dashboard grid layout.
- Resizable widgets.
- Per-device layouts.
- Analytics-driven automatic reordering.
- Marketplace/admin widgets.
- Public profile customization.
- New backend data used by widgets.

## Recommended default order

```txt
1. Hero
2. Stats / overview
3. Today
4. Needs attention
5. Quick create
6. Activity
7. Plans
8. Tools
9. Saved & Agenda
10. Settings & safety
```

Hero and Settings & safety should be protected:

```txt
Hero:
  fixed at top

Settings & safety:
  can move only within the lower group, or stays fixed at bottom for v1
```

## First user-facing customization model

Use section-level controls only:

```txt
Customize Me

Visible sections
[✓] Today
[✓] Needs attention
[✓] Quick create
[✓] Activity
[✓] Plans
[✓] Tools
[✓] Saved & Agenda
[✓] Settings & safety

Order
↑ Today              ↓
↑ Needs attention    ↓
↑ Quick create       ↓
↑ Activity           ↓
↑ Plans              ↓
↑ Tools              ↓
↑ Saved & Agenda     ↓

[Reset default] [Done]
```

For mobile web, prefer up/down buttons first. Drag-and-drop can come later once the section model is stable.

## Visibility rules

Some sections can be hidden, but not all.

Recommended v1:

```txt
Always visible:
- Hero
- Settings & safety

Hideable:
- Today
- Needs attention
- Quick create
- Activity
- Plans
- Tools
- Saved & Agenda
```

If a user hides a feature-gated section, it should stay hidden after the feature becomes available, unless they reset defaults.

If a feature flag is off, the section should not render even if the saved preference says it is visible.

## Storage strategy

### Phase A — local-only prototype

Best for first implementation if we want to test UX without backend risk.

```txt
localStorage key:
hellowhen.meHub.layout.v1
```

Shape:

```ts
type MeHubSectionKey =
  | 'today'
  | 'needs_attention'
  | 'quick_create'
  | 'activity'
  | 'plans'
  | 'tools'
  | 'saved_agenda'
  | 'settings_safety';

type MeHubLayoutPreferenceV1 = {
  version: 1;
  order: MeHubSectionKey[];
  hidden: MeHubSectionKey[];
  updatedAt: string;
};
```

Rules:

- Invalid keys are ignored.
- Missing known keys are appended in default order.
- Protected sections cannot be hidden.
- Reset removes the local preference.

### Phase B — server persistence

Add only after local UX is approved.

Possible model:

```txt
UserPreference
  id
  userId
  key
  valueJson
  createdAt
  updatedAt
```

Recommended key:

```txt
me_hub_layout_v1
```

Backend rules:

- Owner-only.
- Auth required.
- Validate known section keys.
- Strip unknown keys.
- Keep versioned value shape.
- Do not store feature-flag state; calculate that at render time.

## Accessibility and usability rules

- Up/down controls must have clear labels.
- The Customize button should not be the primary Me action.
- Hidden sections should be recoverable from Customize Me.
- Reset default must be available.
- Keyboard users should be able to reorder without drag-and-drop.
- Touch targets should remain at least 44px high on mobile web.
- Do not rely only on color to indicate hidden/visible state.

## Suggested implementation phases

### ME-WIDGET6 — Local-only section customization prototype

Scope:

- Web only.
- Add Customize Me button in a quiet location.
- Add a Customize Me panel or page.
- Up/down controls for section order.
- Hide/show controls for allowed sections.
- Persist in localStorage only.
- No backend.
- No DB.
- No API.

### ME-WIDGET7 — Customization polish and guardrails

Scope:

- Improve mobile web customize screen.
- Add reset default confirmation.
- Add invalid preference cleanup.
- Add protected section behavior.
- Add empty-state handling if many sections are hidden.

### ME-WIDGET8 — Server-side preferences foundation

Scope:

- Add a generic user preference API/model if one does not already exist.
- Store `me_hub_layout_v1`.
- Owner-only access.
- Keep localStorage fallback.
- No customization for main nav.

### ME-WIDGET9 — Cross-device Me layout sync

Scope:

- Save Me section order/hide preferences to server.
- Load preference on sign-in.
- Keep local-only preference for signed-out users.
- Add migration path from localStorage to server preference after login.

## Recommended next step

Do not implement persistence yet.

The next safest build step is:

```txt
ME-WIDGET6 — Local-only section customization prototype
```

Only start that after reviewing the final Me hub layout from ME-WIDGET1 through ME-WIDGET4 in browser/mobile web.
