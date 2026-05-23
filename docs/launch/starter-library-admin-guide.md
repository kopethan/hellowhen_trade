# Starter Need/Offer library admin guide

This guide documents the first-launch starter library for Hellowhen Trade.

## Purpose

Starter templates are reusable example Needs and Offers. They help new users understand what a safe, practical exchange can look like before they create their own inventory.

The first-launch set is focused on 18+ creatives, freelancers, micro-entrepreneurs, solo founders, expats, newcomers, and international professionals in Paris/France.

## Current storage and flow

Starter templates are stored as `InventoryTemplate` records seeded from `apps/api/prisma/seed.ts`.

Users see active templates through the starter inventory API and can clone a template into their own Need or Offer. Cloning creates a normal user-owned Need or Offer linked back to the source template.

Admins manage templates from `/admin/library`. Hiding a template changes its status to hidden/archived for future starter lists, but it does not delete existing user-created Needs or Offers.

## First-launch content rules

Keep templates:

- 18+ and professional.
- Practical for a small skill/service exchange.
- Friendly, clear, and realistic.
- Safe for Facebook, creative, freelancer, and local community outreach.
- Focused on trade/exchange, not hiring or paid work.

Do not add templates for:

- minors or teen accounts;
- dating or adult content;
- illegal, unsafe, undeclared cash, gambling, crypto, or get-rich-quick activity;
- professional medical, legal, or financial advice;
- real-money trades, wallet, payout, Stripe, Airwallex, or Plans flows.

## Images

The current admin library supports up to 5 starter images per template. Admin-uploaded images are attached to the `inventory_template` entity and are copied when a user clones the starter into a Need or Offer.

The seed does not add image files. Add images manually only when Hellowhen owns the image or has clear permission to use it.

Recommended safe image types:

- original screenshots of generic draft layouts with no private data;
- original photos of neutral desks, cameras, notebooks, laptops, products, or creative tools;
- abstract brand-color/font mood boards created for Hellowhen;
- placeholder visuals made specifically for this starter library.

Avoid:

- copyrighted portfolio/client work;
- stock images without license tracking;
- fake testimonials, fake client logos, private addresses, personal documents, or identifiable people without permission.

## QA checklist

After running the seed, check:

1. `/admin/library` loads about 30 active English starter templates and about 30 active French starter templates.
2. Old first-launch starter templates that are no longer part of the curated set are hidden/archived, not deleted.
3. The user Starter tab shows Need templates when browsing Needs and Offer templates when browsing Offers.
4. Cloning a Need creates a normal active Need owned by the current user.
5. Cloning an Offer creates a normal active Offer owned by the current user.
6. Hiding a starter removes it from the public starter list.
7. Restoring a starter makes it visible again.
8. If starter images are attached manually, cloned Needs/Offers receive copied media records and show the images in the user inventory UI.
