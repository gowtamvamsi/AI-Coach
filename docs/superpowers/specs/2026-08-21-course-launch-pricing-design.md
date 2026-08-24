# Course Launch Pricing Design

## Goal

Publish the course price transparently while presenting the initial discount as
a launch offer:

- Standard price: `₹34,999`
- Launch price: `₹29,999`
- Offer wording: `Launch offer · First 45 days`

The launch offer is active immediately. No calendar deadline is displayed and
the site does not expire it automatically; the price remains `₹29,999` until it
is changed manually.

## Placement

Keep the existing buyer-journey order unchanged.

1. The early flagship course card shows a compact price preview after the hero
   and trust strip.
2. The full pricing card remains after curriculum, projects, certificate,
   highlights, and instructor.

This gives visitors early price transparency without asking them to make a
purchase decision before seeing the course's value and proof.

## Price Presentation

Both locations use the same shared React price component and the same values
from `window.COURSE_INFO`:

- `₹34,999` appears smaller with a strikethrough.
- `₹29,999` is the dominant price.
- `Launch offer · First 45 days` appears as a restrained launch badge.
- The existing one-time-payment, inclusive-of-GST, and no-subscription context
  remains.
- A small secondary caption reads:
  `18% GST is already included and paid to the Government.`

The early card retains its separate `One-time payment` label. The later pricing
card retains `One-time payment · Inclusive of GST · No subscription`.

## Data and Behavior

Add explicit pricing fields to `window.COURSE_INFO`:

- `price: 29999`
- `listPrice: 34999`
- `priceOfferLabel: "Launch offer · First 45 days"`
- `priceTaxCaption: "18% GST is already included and paid to the Government."`

There is no countdown, date calculation, local storage, or automatic price
switch. Enrollment/payment button behavior is outside this change and remains
unchanged.

## Visual Treatment

- Use the existing rust accent for the current price and launch badge.
- Keep the struck standard price visually secondary but readable.
- Keep the GST caption smaller and lower-contrast than the payment note.
- Preserve light/dark theme compatibility and existing responsive layouts.

## Verification

- Add regression coverage for both numeric prices, launch wording, and GST
  caption.
- Assert `Will reveal soon` is removed from public course data.
- Assert there is no automatic expiry date or timer.
- Assert both price surfaces render the shared component.
- Confirm the existing section order remains unchanged.
- Build, test, lint, and visually check desktop/mobile in light and dark themes.
