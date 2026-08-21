# Advisor Country-Code Selector Design

## Goal

Add every supported international calling code to the shared course-advisor
phone field while preserving the existing Firestore lead schema.

## User Experience

- Keep the restored advisor popup design.
- Split the phone row into a compact country selector and national-number input.
- Show the selected country as its flag and calling code, such as `🇮🇳 +91`.
- List every country as `Country name (+code)` in a native dropdown.
- Infer the initial country from `navigator.languages` or `navigator.language`.
  Use no geolocation permission, IP lookup, or third-party request.
- Fall back to India (`IN`, `+91`) when the browser locale has no supported
  country region.
- Keep the native selector accessible and mobile-friendly with
  `aria-label="Country code"`, `autocomplete="tel-country-code"`, and a
  national phone input using `autocomplete="tel-national"`.

## Shared Country Data

- Extract the existing complete `V2_DIAL_CODES` list into
  `phone-countries.js`.
- Expose the list and locale/flag helpers as classic-script globals so both the
  shared advisor widget and existing React phone fields consume one source.
- Load the data script before `advisor-widget.js` and `v2.build.js` on every
  public page.

## Submission and Firestore Contract

- Sanitize the national-number input to digits.
- Combine the selected calling code and national number before validation and
  submission: `+44` and `7700900123` become `+447700900123`.
- Continue sending and storing only the existing `phone` field.
- Do not add `country`, `countryCode`, or other Firestore fields.
- Keep `source: "course_enquiry"` and every other lead field unchanged.
- Keep server-side validation at 7–15 total digits and retain the existing
  duplicate/rate-limit behavior using the complete phone value.

## Error Handling

- If the shared country data cannot be loaded, keep the form usable with India
  as a safe local fallback.
- Country changes preserve the entered national number where it remains valid
  and trim only digits beyond the international 15-digit ceiling.
- Existing phone validation messages and server-generic error behavior remain
  unchanged.

## Verification

- Test the full country list and representative shared calling codes.
- Test browser-locale inference and India fallback.
- Test selected flag/code rendering, country changes, digit-only entry, and
  exact combined payload.
- Test that the server and Firestore lead shape still contain only `phone`.
- Verify desktop/mobile layouts in light and dark themes.
- Run the full build, test suite, prerender verification, syntax checks, and
  lint checks.
