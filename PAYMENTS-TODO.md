# Payments / Razorpay — Deferred Findings

> Status: **Razorpay tie‑up in progress — paid checkout is NOT live.**
> These items are intentionally **not fixed yet**. They only affect the **paid**
> booking flow. The **free** webinar flow is live and has been fixed separately.
> Revisit this list before switching paid checkout on.

Source: full UI/UX audit (see chat history). File references are approximate and
should be re‑verified at implementation time.

---

## 1. Razorpay checkout close / failure is unhandled — [High]
- **Where:** `app.jsx` → `handleBookingSubmit` (the `new window.Razorpay(options).open()` path).
- **Problem:** Only a success `handler` is provided. There is no `modal.ondismiss`
  and no `payment.failed` listener. If the user closes the Razorpay sheet or the
  payment fails, they are returned to step 2 with **no error message and no retry
  guidance** — looks frozen.
- **Fix when live:**
  - Add `options.modal = { ondismiss: () => { setBookingError('Payment cancelled — you can try again.'); } }`.
  - Register `rzp.on('payment.failed', (resp) => setBookingError(resp.error?.description || 'Payment failed.'));`.

## 2. Double‑submit on the paid "Pay" button — [High]
- **Where:** `app.jsx` → `handleBookingSubmit`, the paid branch.
- **Problem:** `setBookingLoading(false)` runs **before** `Razorpay.open()`, so the
  "Pay … securely" button is clickable again while the checkout sheet is open →
  duplicate orders possible.
- **Fix when live:** Keep `bookingLoading = true` until Razorpay resolves
  (success/dismiss/fail), then clear it in each handler.

## 3. Non‑localhost "mock" path auto‑confirms without payment — [High]
- **Where:** `app.jsx` → `handleBookingSubmit`, `if (orderData.isMock)` branch
  (the non‑localhost `else` calls `completeBookingSuccess(...)`).
- **Problem:** If the Cloud Function ever returns `isMock: true` in production,
  the user gets a **confirmed seat without paying**.
- **Fix when live:** Never auto‑complete on `isMock` outside localhost. Treat a
  production `isMock` response as an error and surface it.

## 4. Razorpay success handler doesn't await / surface persistence errors — [Medium]
- **Where:** `app.jsx` → Razorpay `handler` → `completeBookingSuccess(...)`.
- **Problem:** The success handler calls `completeBookingSuccess` without `await`
  and Firestore write failures only `console.warn`. User sees success even if the
  booking didn't persist (relies on the webhook).
- **Fix when live:** Ensure the server webhook is the source of truth; on the
  client, confirm via a read‑back or show a "finalizing…" state.

## 5. Mock checkout sandbox screen — [Low / dev‑only]
- **Where:** `app.jsx` mock checkout modal (renders only on `localhost`).
- **Note:** This is a dev simulator that posts a bypass signature to the webhook.
  Ensure the deployed `razorpayWebhook` **rejects** the simulated signature in
  production. Verify in `functions/index.js` before go‑live.

---

## Related (already fixed, free flow)
- Logged‑in user + **free** class showed an empty booking modal → fixed.
- Sold‑out guard, free "₹0" → "Free" label, booking‑success close button,
  guest‑checkout dashboard reconciliation → fixed (see chat / commits).
