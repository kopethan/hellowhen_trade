# Starter idea media guidelines

Starter propositions are templates, not real trades. Media should make the cards feel polished without implying a real user, a bot post, or a messageable trade.

## Supported metadata

Starter idea entries can include media metadata in `tradeFeedIdeas.ts`:

```ts
media: {
  imageUrl?: string;
  imageFocus?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  fallbackVisualKey: 'startup' | 'language' | 'local' | 'objects' | 'creative' | 'feedback' | 'social' | 'admin' | 'video' | 'remote';
}
```

Use `imageUrl` only for approved static/admin-curated images. When the image is missing or fails to load, the feed falls back to the deterministic visual selected by `fallbackVisualKey`.

## Recommended image specs

- Use simple editorial/object/access imagery, not fake user portraits.
- Recommended source size: at least `1200 × 800`.
- Safe crop area: keep the main subject near the center.
- Use `imageFocus` only when the important part is clearly near an edge.
- Avoid screenshots containing private text, phone numbers, emails, addresses, documents, or payment details.

## Product rules

- Do not use media to suggest that a starter idea is already a real trade.
- Do not show fake users or bot-created activity.
- Do not add conversation, proposal, or countdown imagery to starter ideas.
- Keep the card copy clear: users are creating their own version before publishing.
