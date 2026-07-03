// ===============================================================
// Coaching Site V2 — utilities & components
// ===============================================================

const V2_SITE_URL = 'https://balajichippada.com';
const V2_ROADMAP_URL = 'https://ch-balaji.github.io/ai-engineer-roadmap/';

// ===============================================================
// Shared form validation (used by every public-facing form across
// v2.jsx and app.jsx). Two layers:
//   • clean*  — sanitize the value as the user types (strip junk, cap length)
//   • *Error  — return a human message on submit, or '' when valid
// Keeping these in one place means client checks match the Firestore rules
// and we never send a malformed name / email / phone to the backend.
// ===============================================================
const V2_VALIDATE = {
  // First char a letter; then letters (any script), spaces, . ' - only. 2–60 chars.
  NAME_RE: /^\p{L}[\p{L} .'-]{1,59}$/u,
  // Mirrors isValidEmail() in firestore.rules so client + server agree.
  EMAIL_RE: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Throwaway / temp-mail providers — people use these to dodge real signup.
  DISPOSABLE_EMAIL_DOMAINS: [
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.info',
    'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'spam4.me', 'yopmail.com',
    'tempmail.com', 'temp-mail.org', 'trashmail.com', 'getnada.com', 'maildrop.cc',
    'dispostable.com', 'throwawaymail.com', 'fakeinbox.com', 'mailnesia.com',
    'mintemail.com', 'mohmal.com', 'spamgourmet.com', 'tempinbox.com', 'emailondeck.com',
    'moakt.com', 'mailcatch.com', '33mail.com', 'tempr.email', 'discard.email',
  ],
  // Obvious placeholder / "test" domains that look valid but aren't real inboxes.
  JUNK_EMAIL_DOMAINS: [
    'example.com', 'example.org', 'example.net', 'example.edu',
    'test.com', 'testing.com', 'test.test', 'tester.com', 'mailtest.com',
    'yourdomain.com', 'yourmail.com', 'sample.com', 'fake.com', 'nomail.com',
    'noemail.com', 'none.com', 'na.com', 'asdf.com', 'qwerty.com', 'abc.com',
  ],
  // Common misspellings of popular providers → the intended domain (used to
  // suggest a correction rather than silently accept an undeliverable address).
  EMAIL_DOMAIN_TYPOS: {
    'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
    'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com', 'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmail.in': 'gmail.com', 'gamil.com': 'gmail.com',
    'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com', 'ymail.con': 'ymail.com',
    'hotmail.con': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
    'rediffmail.con': 'rediffmail.com', 'rediff.con': 'rediff.com',
  },
  // We accept two shapes:
  //   • a bare 10-digit Indian mobile (first digit 6–9) — the common case, and
  //   • any international number written in E.164 with a leading '+'
  //     (country code 1–9, then 7–14 more digits → 8–15 digits total).
  INDIA_RE: /^[6-9]\d{9}$/,
  E164_RE: /^\+[1-9]\d{7,14}$/,
  DEFAULT_DIAL_CODE: '91', // India — prepended to bare 10-digit numbers on save

  cleanName(v) {
    return String(v == null ? '' : v)
      .replace(/[^\p{L} .'-]/gu, '')   // drop digits & stray symbols
      .replace(/\s{2,}/g, ' ')          // collapse runs of spaces
      .replace(/^\s+/, '')              // no leading space
      .slice(0, 60);
  },
  // Sanitize while typing: keep a single leading '+', strip everything that
  // isn't a digit, cap at the E.164 maximum of 15 digits. International users
  // keep their '+' and country code; Indian users keep their plain 10 digits.
  cleanPhone(v) {
    const s = String(v == null ? '' : v).trim();
    const hasPlus = s.startsWith('+');
    let d = s.replace(/\D+/g, ''); // digits only
    if (!hasPlus && d.length === 11 && d[0] === '0') d = d.slice(1); // strip national trunk 0
    d = d.slice(0, 15);
    return hasPlus ? '+' + d : d;
  },
  // Normalize an accepted number to full E.164 ("+<country><number>") for
  // storage. A bare 10-digit number is treated as an Indian mobile.
  toE164(v) {
    const c = this.cleanPhone(v);
    if (!c) return '';
    if (c.startsWith('+')) return c;
    if (this.INDIA_RE.test(c)) return '+' + this.DEFAULT_DIAL_CODE + c;
    return '+' + c; // already carries a country code, just missing the '+'
  },
  isEmail(v) { return this.EMAIL_RE.test(String(v == null ? '' : v).trim()); },
  isPhone(v) {
    const c = this.cleanPhone(v);
    return c.startsWith('+') ? this.E164_RE.test(c) : this.INDIA_RE.test(c);
  },

  nameError(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return 'Please enter your name.';
    if (s.length < 2) return 'Please enter your full name (at least 2 letters).';
    if (!this.NAME_RE.test(s)) return 'Name can only contain letters, spaces, hyphens and apostrophes.';
    return '';
  },
  // Synchronous email check: format + common typos + disposable/placeholder
  // domains. Returns '' when the address looks legitimate, else a message.
  emailError(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return 'Please enter your email address.';
    if (!this.EMAIL_RE.test(s)) return 'Please enter a valid email address.';
    if (/\.{2,}/.test(s) || s.startsWith('.') || s.includes('.@') || s.includes('@.')) {
      return 'Please enter a valid email address.';
    }
    const domain = s.slice(s.lastIndexOf('@') + 1);
    if (this.EMAIL_DOMAIN_TYPOS[domain]) {
      return `Did you mean @${this.EMAIL_DOMAIN_TYPOS[domain]}? Please double-check your email.`;
    }
    // RFC 2606 reserved TLDs — these can never receive real mail.
    if (/\.(test|example|invalid|localhost|local)$/.test(domain)) {
      return 'Please enter a real email address — that domain can’t receive mail.';
    }
    if (this.JUNK_EMAIL_DOMAINS.includes(domain)) {
      return 'That looks like a placeholder address. Please enter your real email.';
    }
    if (this.DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      return 'Temporary / disposable email addresses aren’t allowed — please use your real email.';
    }
    return '';
  },
  // Async deliverability check: confirms the domain actually exists and can
  // receive mail, using DNS-over-HTTPS (no backend needed). FAIL-OPEN — if the
  // lookup is blocked, offline, or inconclusive we return '' so a real user is
  // never turned away by a transient DNS issue. Catches typo'd / made-up domains
  // (e.g. user@asdkjh.com) that pass the format + blocklist checks.
  async emailDeliverableError(v) {
    try {
      const s = String(v == null ? '' : v).trim().toLowerCase();
      const at = s.lastIndexOf('@');
      if (at < 0) return '';
      const domain = s.slice(at + 1);
      if (!domain || domain.indexOf('.') < 0) return '';
      const NXDOMAIN = 'This email domain doesn’t exist — please check the spelling.';
      const NOMAIL = 'This email domain can’t receive mail — please use a real email.';
      const lookup = (type) => fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
        { headers: { accept: 'application/dns-json' } },
      ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

      const mx = await lookup('MX');
      if (!mx) return ''; // lookup failed → fail open
      if (mx.Status === 3) return NXDOMAIN; // NXDOMAIN: domain not registered
      if (Array.isArray(mx.Answer) && mx.Answer.some((a) => a.type === 15)) return ''; // has MX → deliverable

      // No MX record → a domain may still accept mail via its A record (RFC 5321).
      const a = await lookup('A');
      if (!a) return '';
      if (a.Status === 3) return NXDOMAIN;
      if (Array.isArray(a.Answer) && a.Answer.length) return '';
      // Domain resolves but has neither MX nor A → cannot receive mail.
      if (mx.Status === 0 && a.Status === 0) return NOMAIL;
      return '';
    } catch (e) {
      return ''; // never block a real user on an unexpected error
    }
  },
  // required=false → empty is OK (optional field); any entered value must still be valid.
  phoneError(v, required) {
    const c = this.cleanPhone(v);
    if (!c) return required ? 'Please enter your phone number.' : '';
    if (!this.isPhone(v)) return 'Please enter a valid phone number for the selected country code.';
    return '';
  },
};
if (typeof window !== 'undefined') window.V2_VALIDATE = V2_VALIDATE;

// ===============================================================
// Country-code dropdown + phone input — used by EVERY phone field
// (booking, profile, sign-up). Stores the full E.164 value
// ("+<dial><number>") in the parent's phone state. Defaults to India
// (+91) so a country code is always selected; the user must pick theirs.
// ===============================================================
// India first (default selection); the rest alphabetical by name for findability.
// `max` overrides the default 10-digit national-number cap where a country runs
// longer (e.g. China/Germany mobiles can be 11).
const V2_DIAL_CODES = [
  { iso: 'IN', dial: '+91', name: 'India' },
  { iso: 'AF', dial: '+93', name: 'Afghanistan' },
  { iso: 'AL', dial: '+355', name: 'Albania' },
  { iso: 'DZ', dial: '+213', name: 'Algeria' },
  { iso: 'AD', dial: '+376', name: 'Andorra' },
  { iso: 'AO', dial: '+244', name: 'Angola' },
  { iso: 'AG', dial: '+1268', name: 'Antigua and Barbuda' },
  { iso: 'AR', dial: '+54', name: 'Argentina' },
  { iso: 'AM', dial: '+374', name: 'Armenia' },
  { iso: 'AW', dial: '+297', name: 'Aruba' },
  { iso: 'AU', dial: '+61', name: 'Australia' },
  { iso: 'AT', dial: '+43', name: 'Austria', max: 13 },
  { iso: 'AZ', dial: '+994', name: 'Azerbaijan' },
  { iso: 'BS', dial: '+1242', name: 'Bahamas' },
  { iso: 'BH', dial: '+973', name: 'Bahrain' },
  { iso: 'BD', dial: '+880', name: 'Bangladesh' },
  { iso: 'BB', dial: '+1246', name: 'Barbados' },
  { iso: 'BY', dial: '+375', name: 'Belarus' },
  { iso: 'BE', dial: '+32', name: 'Belgium' },
  { iso: 'BZ', dial: '+501', name: 'Belize' },
  { iso: 'BJ', dial: '+229', name: 'Benin' },
  { iso: 'BM', dial: '+1441', name: 'Bermuda' },
  { iso: 'BT', dial: '+975', name: 'Bhutan' },
  { iso: 'BO', dial: '+591', name: 'Bolivia' },
  { iso: 'BA', dial: '+387', name: 'Bosnia and Herzegovina' },
  { iso: 'BW', dial: '+267', name: 'Botswana' },
  { iso: 'BR', dial: '+55', name: 'Brazil' },
  { iso: 'BN', dial: '+673', name: 'Brunei' },
  { iso: 'BG', dial: '+359', name: 'Bulgaria' },
  { iso: 'BF', dial: '+226', name: 'Burkina Faso' },
  { iso: 'BI', dial: '+257', name: 'Burundi' },
  { iso: 'KH', dial: '+855', name: 'Cambodia' },
  { iso: 'CM', dial: '+237', name: 'Cameroon' },
  { iso: 'CA', dial: '+1', name: 'Canada' },
  { iso: 'CV', dial: '+238', name: 'Cape Verde' },
  { iso: 'KY', dial: '+1345', name: 'Cayman Islands' },
  { iso: 'CF', dial: '+236', name: 'Central African Republic' },
  { iso: 'TD', dial: '+235', name: 'Chad' },
  { iso: 'CL', dial: '+56', name: 'Chile' },
  { iso: 'CN', dial: '+86', name: 'China', max: 11 },
  { iso: 'CO', dial: '+57', name: 'Colombia' },
  { iso: 'KM', dial: '+269', name: 'Comoros' },
  { iso: 'CD', dial: '+243', name: 'Congo (DRC)' },
  { iso: 'CG', dial: '+242', name: 'Congo (Republic)' },
  { iso: 'CR', dial: '+506', name: 'Costa Rica' },
  { iso: 'CI', dial: '+225', name: "Côte d'Ivoire" },
  { iso: 'HR', dial: '+385', name: 'Croatia' },
  { iso: 'CU', dial: '+53', name: 'Cuba' },
  { iso: 'CY', dial: '+357', name: 'Cyprus' },
  { iso: 'CZ', dial: '+420', name: 'Czechia' },
  { iso: 'DK', dial: '+45', name: 'Denmark' },
  { iso: 'DJ', dial: '+253', name: 'Djibouti' },
  { iso: 'DM', dial: '+1767', name: 'Dominica' },
  { iso: 'DO', dial: '+1809', name: 'Dominican Republic' },
  { iso: 'EC', dial: '+593', name: 'Ecuador' },
  { iso: 'EG', dial: '+20', name: 'Egypt' },
  { iso: 'SV', dial: '+503', name: 'El Salvador' },
  { iso: 'GQ', dial: '+240', name: 'Equatorial Guinea' },
  { iso: 'ER', dial: '+291', name: 'Eritrea' },
  { iso: 'EE', dial: '+372', name: 'Estonia' },
  { iso: 'SZ', dial: '+268', name: 'Eswatini' },
  { iso: 'ET', dial: '+251', name: 'Ethiopia' },
  { iso: 'FJ', dial: '+679', name: 'Fiji' },
  { iso: 'FI', dial: '+358', name: 'Finland' },
  { iso: 'FR', dial: '+33', name: 'France' },
  { iso: 'GA', dial: '+241', name: 'Gabon' },
  { iso: 'GM', dial: '+220', name: 'Gambia' },
  { iso: 'GE', dial: '+995', name: 'Georgia' },
  { iso: 'DE', dial: '+49', name: 'Germany', max: 11 },
  { iso: 'GH', dial: '+233', name: 'Ghana' },
  { iso: 'GR', dial: '+30', name: 'Greece' },
  { iso: 'GL', dial: '+299', name: 'Greenland' },
  { iso: 'GD', dial: '+1473', name: 'Grenada' },
  { iso: 'GT', dial: '+502', name: 'Guatemala' },
  { iso: 'GN', dial: '+224', name: 'Guinea' },
  { iso: 'GW', dial: '+245', name: 'Guinea-Bissau' },
  { iso: 'GY', dial: '+592', name: 'Guyana' },
  { iso: 'HT', dial: '+509', name: 'Haiti' },
  { iso: 'HN', dial: '+504', name: 'Honduras' },
  { iso: 'HK', dial: '+852', name: 'Hong Kong' },
  { iso: 'HU', dial: '+36', name: 'Hungary' },
  { iso: 'IS', dial: '+354', name: 'Iceland' },
  { iso: 'ID', dial: '+62', name: 'Indonesia' },
  { iso: 'IR', dial: '+98', name: 'Iran' },
  { iso: 'IQ', dial: '+964', name: 'Iraq' },
  { iso: 'IE', dial: '+353', name: 'Ireland' },
  { iso: 'IL', dial: '+972', name: 'Israel' },
  { iso: 'IT', dial: '+39', name: 'Italy' },
  { iso: 'JM', dial: '+1876', name: 'Jamaica' },
  { iso: 'JP', dial: '+81', name: 'Japan' },
  { iso: 'JO', dial: '+962', name: 'Jordan' },
  { iso: 'KZ', dial: '+7', name: 'Kazakhstan' },
  { iso: 'KE', dial: '+254', name: 'Kenya' },
  { iso: 'KI', dial: '+686', name: 'Kiribati' },
  { iso: 'KW', dial: '+965', name: 'Kuwait' },
  { iso: 'KG', dial: '+996', name: 'Kyrgyzstan' },
  { iso: 'LA', dial: '+856', name: 'Laos' },
  { iso: 'LV', dial: '+371', name: 'Latvia' },
  { iso: 'LB', dial: '+961', name: 'Lebanon' },
  { iso: 'LS', dial: '+266', name: 'Lesotho' },
  { iso: 'LR', dial: '+231', name: 'Liberia' },
  { iso: 'LY', dial: '+218', name: 'Libya' },
  { iso: 'LI', dial: '+423', name: 'Liechtenstein' },
  { iso: 'LT', dial: '+370', name: 'Lithuania' },
  { iso: 'LU', dial: '+352', name: 'Luxembourg' },
  { iso: 'MO', dial: '+853', name: 'Macau' },
  { iso: 'MG', dial: '+261', name: 'Madagascar' },
  { iso: 'MW', dial: '+265', name: 'Malawi' },
  { iso: 'MY', dial: '+60', name: 'Malaysia' },
  { iso: 'MV', dial: '+960', name: 'Maldives' },
  { iso: 'ML', dial: '+223', name: 'Mali' },
  { iso: 'MT', dial: '+356', name: 'Malta' },
  { iso: 'MH', dial: '+692', name: 'Marshall Islands' },
  { iso: 'MR', dial: '+222', name: 'Mauritania' },
  { iso: 'MU', dial: '+230', name: 'Mauritius' },
  { iso: 'MX', dial: '+52', name: 'Mexico' },
  { iso: 'FM', dial: '+691', name: 'Micronesia' },
  { iso: 'MD', dial: '+373', name: 'Moldova' },
  { iso: 'MC', dial: '+377', name: 'Monaco' },
  { iso: 'MN', dial: '+976', name: 'Mongolia' },
  { iso: 'ME', dial: '+382', name: 'Montenegro' },
  { iso: 'MA', dial: '+212', name: 'Morocco' },
  { iso: 'MZ', dial: '+258', name: 'Mozambique' },
  { iso: 'MM', dial: '+95', name: 'Myanmar' },
  { iso: 'NA', dial: '+264', name: 'Namibia' },
  { iso: 'NR', dial: '+674', name: 'Nauru' },
  { iso: 'NP', dial: '+977', name: 'Nepal' },
  { iso: 'NL', dial: '+31', name: 'Netherlands' },
  { iso: 'NZ', dial: '+64', name: 'New Zealand' },
  { iso: 'NI', dial: '+505', name: 'Nicaragua' },
  { iso: 'NE', dial: '+227', name: 'Niger' },
  { iso: 'NG', dial: '+234', name: 'Nigeria' },
  { iso: 'KP', dial: '+850', name: 'North Korea' },
  { iso: 'MK', dial: '+389', name: 'North Macedonia' },
  { iso: 'NO', dial: '+47', name: 'Norway' },
  { iso: 'OM', dial: '+968', name: 'Oman' },
  { iso: 'PK', dial: '+92', name: 'Pakistan' },
  { iso: 'PW', dial: '+680', name: 'Palau' },
  { iso: 'PS', dial: '+970', name: 'Palestine' },
  { iso: 'PA', dial: '+507', name: 'Panama' },
  { iso: 'PG', dial: '+675', name: 'Papua New Guinea' },
  { iso: 'PY', dial: '+595', name: 'Paraguay' },
  { iso: 'PE', dial: '+51', name: 'Peru' },
  { iso: 'PH', dial: '+63', name: 'Philippines' },
  { iso: 'PL', dial: '+48', name: 'Poland' },
  { iso: 'PT', dial: '+351', name: 'Portugal' },
  { iso: 'PR', dial: '+1787', name: 'Puerto Rico' },
  { iso: 'QA', dial: '+974', name: 'Qatar' },
  { iso: 'RO', dial: '+40', name: 'Romania' },
  { iso: 'RU', dial: '+7', name: 'Russia' },
  { iso: 'RW', dial: '+250', name: 'Rwanda' },
  { iso: 'KN', dial: '+1869', name: 'Saint Kitts and Nevis' },
  { iso: 'LC', dial: '+1758', name: 'Saint Lucia' },
  { iso: 'VC', dial: '+1784', name: 'Saint Vincent and the Grenadines' },
  { iso: 'WS', dial: '+685', name: 'Samoa' },
  { iso: 'SM', dial: '+378', name: 'San Marino' },
  { iso: 'ST', dial: '+239', name: 'Sao Tome and Principe' },
  { iso: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { iso: 'SN', dial: '+221', name: 'Senegal' },
  { iso: 'RS', dial: '+381', name: 'Serbia' },
  { iso: 'SC', dial: '+248', name: 'Seychelles' },
  { iso: 'SL', dial: '+232', name: 'Sierra Leone' },
  { iso: 'SG', dial: '+65', name: 'Singapore' },
  { iso: 'SK', dial: '+421', name: 'Slovakia' },
  { iso: 'SI', dial: '+386', name: 'Slovenia' },
  { iso: 'SB', dial: '+677', name: 'Solomon Islands' },
  { iso: 'SO', dial: '+252', name: 'Somalia' },
  { iso: 'ZA', dial: '+27', name: 'South Africa' },
  { iso: 'KR', dial: '+82', name: 'South Korea' },
  { iso: 'SS', dial: '+211', name: 'South Sudan' },
  { iso: 'ES', dial: '+34', name: 'Spain' },
  { iso: 'LK', dial: '+94', name: 'Sri Lanka' },
  { iso: 'SD', dial: '+249', name: 'Sudan' },
  { iso: 'SR', dial: '+597', name: 'Suriname' },
  { iso: 'SE', dial: '+46', name: 'Sweden' },
  { iso: 'CH', dial: '+41', name: 'Switzerland' },
  { iso: 'SY', dial: '+963', name: 'Syria' },
  { iso: 'TW', dial: '+886', name: 'Taiwan' },
  { iso: 'TJ', dial: '+992', name: 'Tajikistan' },
  { iso: 'TZ', dial: '+255', name: 'Tanzania' },
  { iso: 'TH', dial: '+66', name: 'Thailand' },
  { iso: 'TL', dial: '+670', name: 'Timor-Leste' },
  { iso: 'TG', dial: '+228', name: 'Togo' },
  { iso: 'TO', dial: '+676', name: 'Tonga' },
  { iso: 'TT', dial: '+1868', name: 'Trinidad and Tobago' },
  { iso: 'TN', dial: '+216', name: 'Tunisia' },
  { iso: 'TR', dial: '+90', name: 'Turkey' },
  { iso: 'TM', dial: '+993', name: 'Turkmenistan' },
  { iso: 'TV', dial: '+688', name: 'Tuvalu' },
  { iso: 'UG', dial: '+256', name: 'Uganda' },
  { iso: 'UA', dial: '+380', name: 'Ukraine' },
  { iso: 'AE', dial: '+971', name: 'United Arab Emirates' },
  { iso: 'GB', dial: '+44', name: 'United Kingdom' },
  { iso: 'US', dial: '+1', name: 'United States' },
  { iso: 'UY', dial: '+598', name: 'Uruguay' },
  { iso: 'UZ', dial: '+998', name: 'Uzbekistan' },
  { iso: 'VU', dial: '+678', name: 'Vanuatu' },
  { iso: 'VA', dial: '+379', name: 'Vatican City' },
  { iso: 'VE', dial: '+58', name: 'Venezuela' },
  { iso: 'VN', dial: '+84', name: 'Vietnam' },
  { iso: 'YE', dial: '+967', name: 'Yemen' },
  { iso: 'ZM', dial: '+260', name: 'Zambia' },
  { iso: 'ZW', dial: '+263', name: 'Zimbabwe' },
];
// Flag emoji from an ISO-2 code (regional indicator letters).
function v2Flag(iso) {
  try { return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65)); }
  catch (e) { return ''; }
}
// Split a stored E.164 string into { dial, local }. Longest dial-code prefix
// wins; bare/legacy digits (no '+') are treated as a local Indian number.
function v2SplitE164(v) {
  const s = String(v == null ? '' : v).trim();
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    let best = '';
    for (const c of V2_DIAL_CODES) {
      const d = c.dial.slice(1);
      if (digits.startsWith(d) && d.length > best.length) best = d;
    }
    if (best) return { dial: '+' + best, local: digits.slice(best.length) };
    return { dial: '+91', local: digits };
  }
  return { dial: '+91', local: s.replace(/\D/g, '') };
}
function V2PhoneField({ value, onChange, id, name, required, placeholder, inputClassName }) {
  const parsed = v2SplitE164(value);
  const [iso, setIso] = useState(() => {
    const m = V2_DIAL_CODES.find((c) => c.dial === parsed.dial);
    return m ? m.iso : 'IN';
  });
  const sel = V2_DIAL_CODES.find((c) => c.iso === iso) || V2_DIAL_CODES[0];
  const dial = sel.dial;
  const local = parsed.local;
  // National-number length: 10 covers India/US/UK and most countries; a few
  // differ (e.g. China mobiles = 11), set via `max` on the dial-code entry.
  const maxLen = sel.max || 10;
  const onPickCountry = (newIso) => {
    const c = V2_DIAL_CODES.find((x) => x.iso === newIso) || V2_DIAL_CODES[0];
    setIso(newIso);
    onChange(c.dial + local.slice(0, c.max || 10));
  };
  const onTypeNumber = (raw) => onChange(dial + raw.replace(/\D/g, '').slice(0, maxLen));
  return (
    <div className="v2-phone-field">
      <div className="v2-phone-cc-wrap">
        {/* Short flag+code shown for the SELECTED state; the real <select> text is
            hidden (color:transparent) so long country names don't get cut off.
            The open dropdown still lists full "flag name (code)" labels. */}
        <span className="v2-phone-cc-display" aria-hidden="true">{v2Flag(sel.iso)} {sel.dial}</span>
        <select
          className="form-input v2-phone-cc"
          value={iso}
          onChange={(e) => onPickCountry(e.target.value)}
          aria-label="Country code"
          autoComplete="tel-country-code"
          required
        >
          {V2_DIAL_CODES.map((c) => (
            <option key={c.iso} value={c.iso}>{c.name} ({c.dial})</option>
          ))}
        </select>
        <span className="v2-phone-cc-caret" aria-hidden="true">▾</span>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className={inputClassName || 'form-input'}
        id={id}
        name={name}
        required={required}
        maxLength={maxLen}
        placeholder={placeholder || 'Phone number'}
        value={local}
        onChange={(e) => onTypeNumber(e.target.value)}
      />
    </div>
  );
}
if (typeof window !== 'undefined') window.V2PhoneField = V2PhoneField;

// ===============================================================
// UTM Tracking & Lead Persistence Utilities
// ===============================================================
const V2_UTM_HELPERS = {
  captureFromUrl() {
    if (typeof window === 'undefined') return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const utmParams = {};
      const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'source'];
      let hasParams = false;

      keys.forEach((key) => {
        const value = searchParams.get(key);
        if (value) {
          utmParams[key] = value.trim();
          hasParams = true;
        }
      });

      if (hasParams) {
        let existing = {};
        try {
          const stored = localStorage.getItem('lead_utm_params');
          if (stored) {
            existing = JSON.parse(stored);
          }
        } catch (_) {}
        
        const merged = Object.assign({}, existing, utmParams);
        localStorage.setItem('lead_utm_params', JSON.stringify(merged));
        console.log('[UTM] Saved parameters:', merged);
      }
    } catch (err) {
      console.warn('[UTM] Capture failed:', err);
    }
  },

  getStored() {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('lead_utm_params');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
    return {};
  },

  clear() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('lead_utm_params');
    } catch (_) {}
  }
};

// Run UTM parsing immediately on load
if (typeof window !== 'undefined') {
  V2_UTM_HELPERS.captureFromUrl();
}

// All editable content/copy lives in site.config.js → window.SITE_CONFIG.
// V2_CONFIG below is the legacy feature-flag object; it reads from SITE_CONFIG
// when present (so flipping flags in site.config.js works without code edits).
const _SC = (typeof window !== 'undefined' && window.SITE_CONFIG) || {};
const _FF = _SC.featureFlags || {};
const V2_CONFIG = {
  showWelcomePopup: _FF.showWelcomePopup !== false,
  welcomePopupDelayMs: (_SC.welcomePopup && _SC.welcomePopup.delayMs) || 1800,
  showQuoteBand: _FF.showQuoteBand === true,
  showSuccessStories: _FF.showSuccessStories === true,
  showHowItWorks: _FF.showHowItWorks !== false,
  showWhereToStart: _FF.showWhereToStart !== false,
  showHeroSecondaryCta: _FF.showHeroSecondaryCta !== false,
  showCurriculumSection: _FF.showCurriculumSection !== false,
};

// Brand identity & socials sourced from site.config.js (window.SITE_CONFIG.brand).
// Fallback object below is used if the config file failed to load — keeps the app booting.
const V2_BRAND = Object.assign({
  name: 'Balaji Chippada',
  tagline: 'The Agent Engineer',
  youtubeChannel: 'https://www.youtube.com/@balajichippada',
  roadmapVideoId: 'Mf_J_PVGTdA',
  roadmapVideoUrl: 'https://www.youtube.com/watch?v=Eze6D8jAMjI',
  whatsappCommunity: 'https://chat.whatsapp.com/GASHZYf7wBA23nQvb39lIP',
  linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
  instagram: 'https://www.instagram.com/balajichippada',
  github: 'https://github.com/ch-balaji',
}, (_SC.brand || {}));

const V2_SOCIAL = Object.assign({
  youtubeSubs: '26K+',
  roadmapViews: '170K+',
  studentsTrained: '3000+',
}, ((_SC.brand && _SC.brand.stats) || {}));

const V2_INSTRUCTOR = Object.assign({
  name: 'Balaji Chippada',
  title: 'Senior AI Engineer · Roadmap creator',
  photo: '',
  bio: 'Builder + teacher of agentic AI systems.',
  linkedin: V2_BRAND.linkedin,
  youtube: V2_BRAND.youtubeChannel,
}, (_SC.instructor || {}));

// Rotating testimonials — read from site.config.js so we can swap in real YouTube comments later.
const V2_HERO_QUOTES = (_SC.heroQuotes && _SC.heroQuotes.length) ? _SC.heroQuotes : [
  { text: 'Shipped my first agent in 3 days — demo-first teaching just works.', author: 'Rahul · SDE, Bengaluru' },
  { text: 'Finally got LLM vs workflow vs agent. Balaji shows the agent running first.', author: 'Sneha · ML engineer' },
];

// Optional configured masterclass — merged into the runtime Firestore doc.
// Lets you edit title/copy/curriculum/thumbnail in code while Firestore handles live state (seats etc).
const V2_CONFIG_MASTERCLASS = _SC.nextMasterclass || null;

// Single source of truth: site.config.js wins for ALL content (title, price,
// dateTime, curriculum, etc). Firestore only contributes runtime state — booked
// seat count, zoom link / recording link the admin pastes later, status.
//
// This is intentional: if you want to change anything visible, edit site.config.js.
function mergeMcWithConfig(mc, masterclasses, sessions) {
  // If the featured masterclass is explicitly marked as deleted in Firestore, we should not fall back to it
  const featuredId = V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id;
  let isFeaturedDeleted = false;
  if (featuredId) {
    isFeaturedDeleted = [...(masterclasses || []), ...(sessions || [])]
      .some(item => item && item.id === featuredId && (item.deleted || item.status === 'deleted'));
  }

  if (mc) {
    // If the dynamic class is the featured one and it's deleted, don't display it
    if (featuredId && mc.id === featuredId && isFeaturedDeleted) {
      return null;
    }
  } else {
    // Fallback mode: if no upcoming dynamic class, check if the config class is deleted or missing
    if (isFeaturedDeleted || !V2_CONFIG_MASTERCLASS) {
      return null;
    }
  }

  if (!V2_CONFIG_MASTERCLASS && !mc) return null;
  if (!V2_CONFIG_MASTERCLASS) return mc;             // no config → use Firestore as-is
  if (!mc) return Object.assign({}, V2_CONFIG_MASTERCLASS, { instructor: V2_INSTRUCTOR });

  // Map dynamic Firestore content so it completely overrides hardcoded details
  const dynamicContent = {
    id: mc.id || mc.uid || V2_CONFIG_MASTERCLASS.id,
    title: mc.title || V2_CONFIG_MASTERCLASS.title,
    shortTitle: mc.shortTitle || mc.title || V2_CONFIG_MASTERCLASS.shortTitle,
    subtitle: mc.description || mc.subtitle || V2_CONFIG_MASTERCLASS.subtitle,
    about: mc.rawSyllabus || mc.description || V2_CONFIG_MASTERCLASS.about,
    dateTime: mc.dateTime || V2_CONFIG_MASTERCLASS.dateTime,
    price: typeof mc.price === 'number' ? mc.price : V2_CONFIG_MASTERCLASS.price,
    originalPrice: typeof mc.originalPrice === 'number' ? mc.originalPrice : V2_CONFIG_MASTERCLASS.originalPrice,
    videoUrl: mc.videoUrl || mc.youtubeVideoId || mc.videoId || V2_CONFIG_MASTERCLASS.videoUrl || null,
    instructor: Object.assign({}, V2_INSTRUCTOR, 
      typeof mc.instructor === 'object' 
        ? mc.instructor 
        : { name: mc.instructor || V2_INSTRUCTOR.name }
    )
  };

  // Map AI-generated structured syllabus array into curriculum array structure
  if (Array.isArray(mc.syllabus) && mc.syllabus.length > 0) {
    dynamicContent.curriculum = mc.syllabus.map((s, i) => ({
      module: s.index ? `Module ${s.index}` : `Module ${String(i + 1).padStart(2, '0')}`,
      title: s.topicTitle || s.title,
      points: s.subTopics || s.points || []
    }));
  } else if (Array.isArray(mc.curriculum)) {
    dynamicContent.curriculum = mc.curriculum;
  }

  // Runtime live states
  const runtime = {};
  if (typeof mc.seatsBooked === 'number') runtime.seatsBooked = mc.seatsBooked;
  if (mc.seatsTotal) runtime.seatsTotal = mc.seatsTotal;
  if (mc.status) runtime.status = mc.status;
  if (mc.zoomLink) runtime.zoomLink = mc.zoomLink;
  if (mc.recordingUrl) runtime.recordingUrl = mc.recordingUrl;
  if (mc.slidesUrl) runtime.slidesUrl = mc.slidesUrl;
  if (mc.prepPdfUrl) runtime.prepPdfUrl = mc.prepPdfUrl;

  return Object.assign({}, V2_CONFIG_MASTERCLASS, dynamicContent, runtime);
}

function getSeatsRemaining(mc) {
  if (!mc) return 0;
  const total = mc.seatsTotal || 50;
  const booked = mc.seatsBooked || 0;
  return Math.max(0, total - booked);
}

function getNextUpcomingMasterclass(masterclasses, sessions) {
  const all = [...(masterclasses || []), ...(sessions || [])]
    .filter(Boolean)
    .filter(item => !item.deleted && item.status !== 'deleted');

  const getSafeTimestamp = (val) => {
    if (!val) return 0;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val.seconds) return val.seconds * 1000;
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  };

  // 1. Sort all active dynamic classes (excluding the config one if present) by creation time descending
  const dynamicClasses = all
    .filter(item => item.id !== (V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id))
    .sort((a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt));

  if (dynamicClasses.length > 0) {
    return dynamicClasses[0];
  }

  // 2. Fallback: if no active dynamic sessions, check if the featured config session was explicitly deleted
  const featuredId = V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id;
  if (featuredId) {
    const isExplicitlyDeleted = [...(masterclasses || []), ...(sessions || [])]
      .some(item => item && item.id === featuredId && (item.deleted || item.status === 'deleted'));
    if (isExplicitlyDeleted) {
      return null;
    }

    const match = all.find((item) => item && item.id === featuredId);
    if (match) return match;
  }

  // 3. Fallback to null (no upcoming session found)
  return null;
}

// Times render in the VIEWER's local timezone (no forced timeZone). The stored
// dateTime is an absolute instant, so the browser converts correctly; the zone
// label comes from timeZoneName:'short' (e.g. "IST", "EDT") instead of a literal.
function formatMcShortDate(dateTime) {
  if (!dateTime) return 'Date TBA';
  return new Date(dateTime).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatMcFullDateTime(dateTime) {
  if (!dateTime) return 'Date TBA';
  const d = new Date(dateTime);
  return `${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
}

function getMcTiers(mc) {
  if (mc && mc.tiers && mc.tiers.length) return mc.tiers;
  const base = getMcPrice(mc);
  return [
    { name: 'Standard', price: base, includes: ['Live session', '30-day recording', 'Slides & GitHub repo'], recommended: true },
  ];
}

// Reads explicit numeric price (including 0 for FREE).
// Defaults to 0 (free) when undefined — safer than silently charging.
// If you want a paid masterclass, set `price` explicitly in site.config.js or Firestore.
function getMcPrice(mc) {
  if (!mc) return 0;
  if (typeof mc.price === 'number') return mc.price;
  if (mc.tiers && mc.tiers[0] && typeof mc.tiers[0].price === 'number') return mc.tiers[0].price;
  return 0;
}

function isMcFree(mc) {
  // No masterclass = not "free" (avoids null mislabeling CTAs as "Reserve free seat").
  if (!mc) return false;
  return getMcPrice(mc) === 0;
}

function formatMcPriceLabel(mc) {
  if (!mc) return '';
  if (isMcFree(mc)) return 'Free to attend';
  return `₹${getMcPrice(mc).toLocaleString()}`;
}

function formatMcPriceShort(mc) {
  if (!mc) return '';
  return isMcFree(mc) ? 'Free' : `₹${getMcPrice(mc).toLocaleString()}`;
}

// "Actual" anchor price shown struck-through next to the offering price, so the
// class reads as a discount (e.g. ₹299 → Free, or ₹999 → ₹499). Set per class in
// the dashboard "Actual Price" field → `originalPrice` on the masterclass doc
// (or site.config.js `nextMasterclass.originalPrice`). For a FREE class with no
// explicit actual price we fall back to this default so "Free" still reads as a
// discount rather than just "Free".
const V2_FREE_STRIKE_PRICE = 299;
function getMcStrikePrice(mc) {
  // Explicit "Actual Price" set by the admin always wins.
  if (mc && typeof mc.originalPrice === 'number' && mc.originalPrice > 0) return mc.originalPrice;
  // Free class with no explicit anchor → default discount anchor.
  if (isMcFree(mc)) return V2_FREE_STRIKE_PRICE;
  // Paid class with no anchor → nothing to strike through.
  return 0;
}
function V2McPrice({ mc }) {
  const offered = getMcPrice(mc);          // "Offering Price" — what they pay
  const actual = getMcStrikePrice(mc);     // "Actual Price" — struck-through anchor
  const showStrike = actual > offered;     // only strike a genuinely higher price
  return (
    <span className="v2-mc-price">
      {showStrike ? <s className="v2-mc-price-was">₹{actual.toLocaleString()}</s> : null}
      <span className="v2-mc-price-free">{offered === 0 ? 'Free' : `₹${offered.toLocaleString()}`}</span>
    </span>
  );
}

function padIcs(n) { return String(n).padStart(2, '0'); }

// UTC stamp (used for DTSTAMP only).
function toIcsDateUTC(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${padIcs(d.getUTCMonth() + 1)}${padIcs(d.getUTCDate())}T${padIcs(d.getUTCHours())}${padIcs(d.getUTCMinutes())}${padIcs(d.getUTCSeconds())}Z`;
}

// Wall-clock components AS SEEN IN Asia/Kolkata. The page always shows event
// times in IST, so the calendar entry must match that exact wall clock (tagged
// with TZID below) instead of a raw UTC instant that can drift for the viewer.
function toIcsDateIST(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(new Date(date))) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}${p.month}${p.day}T${hour}${p.minute}${p.second}`;
}

function generateICS({ title, startDate, endDate, description, location, organizerEmail }) {
  const uid = `${Date.now()}@agentengineer.in`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Agent Engineer//EN', 'CALSCALE:GREGORIAN',
    // India has no DST, so a single fixed +0530 offset is correct year-round.
    'BEGIN:VTIMEZONE', 'TZID:Asia/Kolkata',
    'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'TZNAME:IST', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${toIcsDateUTC(new Date())}`,
    `DTSTART;TZID=Asia/Kolkata:${toIcsDateIST(startDate)}`,
    `DTEND;TZID=Asia/Kolkata:${toIcsDateIST(endDate)}`,
    `SUMMARY:${title}`, `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location || 'Online'}`, `ORGANIZER:mailto:${organizerEmail || 'team@balajichippada.com'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function openBookingForSession(session, ctx) {
  if (!session) return;
  // Always merge with site.config.js so the wizard sees the SAME price/title/date
  // the rest of the page is showing — no drift between hero and checkout.
  const merged = mergeMcWithConfig(session) || session;
  ctx.setBookingSession(merged);
  ctx.setBookingStep(1);
  ctx.setBookingSuccess(null);
  ctx.setSelectedTier(getMcTiers(merged)[0]);
  ctx.setBookingName(ctx.user?.displayName || '');
  ctx.setBookingEmail(ctx.user?.email || '');
  ctx.setBookingPhone('');
  ctx.setBookingError('');
}

function getMcOutcome(mc) {
  if (mc?.outcome || mc?.deliverable) return mc.outcome || mc.deliverable;
  const t = (mc?.title || '').toLowerCase();
  if (t.includes('claude')) {
    return 'By the end, you\'ll have a Claude Code agent that autonomously reviews PRs in your repo — with TDD workflow, multi-file refactoring, and a critic feedback loop.';
  }
  if (t.includes('rag')) {
    return 'You\'ll deploy a hybrid retrieval pipeline with a golden eval dataset — and know exactly why your RAG is wrong when it fails.';
  }
  if (t.includes('multi-agent') || t.includes('langgraph') || t.includes('orchestr')) {
    return 'You\'ll build a multi-agent graph with supervisors, tools, and memory — with production traces you can show in interviews.';
  }
  if (t.includes('guardrail') || t.includes('llmops')) {
    return 'You\'ll implement guardrails, eval harnesses, and LLMOps patterns that catch agent failures before users do.';
  }
  return mc?.description || 'Live build session — you ship a working agentic AI system on the call, not just watch slides.';
}

// Click-to-play YouTube thumbnail. No iframe loads until user clicks — faster, no ads on the page,
// and we still capture the watch on YouTube once they click through.
// Remembers playback position per video (localStorage) so a lesson resumes
// where the viewer left off. Only mid-watch positions are kept — not the first
// few seconds or the last 5% — and completed lessons clear themselves so they
// start fresh next time.
const V2_VIDEO_RESUME = {
  _key: (id) => `v2_vpos_${id}`,
  MIN_RATIO: 0.05,
  MAX_RATIO: 0.95,
  save(id, sec, dur) {
    if (!id || !dur || !(sec > 5)) return;
    const ratio = sec / dur;
    if (ratio < this.MIN_RATIO || ratio > this.MAX_RATIO) { this.clear(id); return; }
    try { localStorage.setItem(this._key(id), String(Math.floor(sec))); } catch (e) {}
  },
  load(id) {
    if (!id) return 0;
    try {
      const v = parseInt(localStorage.getItem(this._key(id)) || '0', 10);
      return Number.isFinite(v) && v > 5 ? v : 0;
    } catch (e) { return 0; }
  },
  clear(id) { try { localStorage.removeItem(this._key(id)); } catch (e) {} },
  // "Watched" flag — set once a video is completed (80% or ends), shown as a
  // badge so the viewer can see what they've finished. Persists per device.
  _wkey: (id) => `v2_vwatched_${id}`,
  markWatched(id) { if (!id) return; try { localStorage.setItem(this._wkey(id), '1'); } catch (e) {} },
  isWatched(id) {
    if (!id) return false;
    try { if (localStorage.getItem(this._wkey(id)) === '1') return true; } catch (e) {}
    // Account-synced watch state (Firestore, mirrored to window.__VIDEO_PROGRESS
    // by app.jsx). Keyed by videoId, so the same signed-in account shows
    // identical ✓ markers in every tab and on every device — not just whatever
    // this one browser's localStorage holds.
    try {
      const vp = typeof window !== 'undefined' ? window.__VIDEO_PROGRESS : null;
      if (vp && vp[id] && vp[id].completed) return true;
    } catch (e) {}
    return false;
  },
};
// Exposed so roadmap progress (videos.js / app.jsx) derives module completion
// from the SAME "Watched" signal the badges use — keeping them in lockstep.
if (typeof window !== 'undefined') window.__isVideoWatched = (id) => V2_VIDEO_RESUME.isWatched(id);

// Small "✓ Watched" badge overlaid on a player frame once the lesson is done.
function V2WatchedBadge() {
  return (
    <span className="v2-video-watched" aria-label="Watched">
      <span className="v2-video-watched__check" aria-hidden="true">✓</span>
      Watched
    </span>
  );
}

// "Link to code" button pinned bottom-right of a video frame. Resolves the URL
// from the per-video map (videoCodeLinks → window.VIDEO_CODE_LINKS) for the
// given videoId, falling back to a per-link codeUrl. Admins (window.__CODE_ADMIN)
// get an inline add/edit control that writes straight to Firestore — so code
// links are managed right here in the roadmap, not the dashboard.
function V2CodeLink({ videoId, fallbackUrl }) {
  const resolved = (videoId && window.VIDEO_CODE_LINKS && window.VIDEO_CODE_LINKS[videoId]) || fallbackUrl || null;
  const canEdit = !!window.__CODE_ADMIN && !!videoId;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  if (!resolved && !canEdit) return null;

  const openEditor = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setVal(resolved || "");
    setEditing(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fb = window.firebase;
      const ref = fb.firestore().collection("videoCodeLinks").doc(videoId);
      const u = val.trim();
      if (u) {
        await ref.set({ codeUrl: u, updatedAt: fb.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } else {
        await ref.set({ codeUrl: fb.firestore.FieldValue.delete() }, { merge: true });
      }
      setEditing(false);
    } catch (err) {
      console.error("[CODE LINK] save failed:", err);
    }
    setSaving(false);
  };

  if (editing) {
    return (
      <div className="v2-video-code-edit" onClick={(e) => e.stopPropagation()}>
        <input
          className="v2-video-code-input"
          type="url"
          placeholder="https://github.com/…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        />
        <button type="button" className="v2-video-code-btn" onClick={save} disabled={saving}>
          {saving ? "…" : "Save"}
        </button>
        <button type="button" className="v2-video-code-btn v2-video-code-btn--ghost" onClick={() => setEditing(false)} aria-label="Cancel">✕</button>
      </div>
    );
  }

  return (
    <div className="v2-video-code-wrap" onClick={(e) => e.stopPropagation()}>
      {resolved && (
        <a className="v2-video-code" href={resolved} target="_blank" rel="noopener noreferrer" title="Link to code">
          <span className="v2-video-code__icon" aria-hidden="true">&lt;/&gt;</span>
          Code
        </a>
      )}
      {canEdit && (
        <button
          type="button"
          className="v2-video-code v2-video-code--edit-trigger"
          onClick={openEditor}
          title={resolved ? "Edit code link" : "Add code link"}
        >
          {resolved ? "✎" : "+ Code"}
        </button>
      )}
    </div>
  );
}

// Persistent row under every inline player. Videos play on-site (the embed
// still serves ads + counts views/watch-time for the channel), while these
// links recover the engagement a full redirect gave us: a one-tap jump to the
// YouTube watch page (recommendations, comments) and a direct Subscribe CTA.
function V2VideoActions({ watchUrl }) {
  if (!watchUrl) return null;
  const subUrl = `${V2_BRAND.youtubeChannel}?sub_confirmation=1`;
  return (
    <div className="v2-video-actions">
      <a className="v2-video-action v2-video-action--watch" href={watchUrl} target="_blank" rel="noopener noreferrer">
        <span className="v2-video-action-yt" aria-hidden="true">▶</span>
        Watch on YouTube
        <span className="v2-video-action-ext" aria-hidden="true">↗</span>
      </a>
      <a className="v2-video-action v2-video-action--sub" href={subUrl} target="_blank" rel="noopener noreferrer">
        Subscribe
      </a>
    </div>
  );
}

function V2PlaylistEmbed({ playlistId, title, onVideoProgress, mappingId, modules, codeUrl }) {
  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const seedItems = React.useMemo(
    () => (H.getPlaylistItemsSync ? H.getPlaylistItemsSync(playlistId) : []),
    [playlistId]
  );
  const [items, setItems] = useState(seedItems);
  const [loading, setLoading] = useState(seedItems.length === 0);
  const [listFailed, setListFailed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [watchedTick, setWatchedTick] = useState(0);
  const hasStaticSeed = seedItems.length > 0;
  const canTrack = Boolean(onVideoProgress && modules && modules.length);
  // Which lessons in this playlist are already watched (for the ✓ markers).
  const watchedSet = React.useMemo(() => {
    const s = new Set();
    (items || []).forEach((v) => { if (v.videoId && V2_VIDEO_RESUME.isWatched(v.videoId)) s.add(v.videoId); });
    return s;
  }, [items, watchedTick]);

  // Re-derive the ✓ markers whenever the account-synced progress changes — on
  // first Firestore load, or when another tab/device marks a lesson watched —
  // so every open tab shows the same watched set.
  useEffect(() => {
    const onSync = () => setWatchedTick((t) => t + 1);
    window.addEventListener('roadmap-progress-sync', onSync);
    return () => window.removeEventListener('roadmap-progress-sync', onSync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasStaticSeed) setLoading(true);
    setListFailed(false);
    (H.fetchPlaylistItems ? H.fetchPlaylistItems(playlistId) : Promise.resolve(seedItems))
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) {
          setItems((prev) => (list.length >= prev.length ? list : prev));
          setListFailed(false);
          setActiveIdx((idx) => Math.min(idx, Math.max(list.length, seedItems.length) - 1));
        } else if (!hasStaticSeed) {
          setListFailed(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          if (!hasStaticSeed && items.length === 0) setListFailed(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [playlistId, hasStaticSeed]);

  useEffect(() => {
    if (!items.length) return;
    items.slice(0, 10).forEach((v) => {
      if (!v.videoId) return;
      const img = new Image();
      img.src = H.youtubePoster ? H.youtubePoster(v.videoId) : (H.youtubeThumbnail ? H.youtubeThumbnail(v.videoId) : `https://i.ytimg.com/vi/${v.videoId}/maxresdefault.jpg`);
    });
  }, [items]);

  const active = items[activeIdx];
  const goPrev = () => setActiveIdx((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIdx((i) => Math.min(items.length - 1, i + 1));
  const scrollListRef = React.useRef(null);

  const videoIndex = activeIdx + 1;

  // These videos open on YouTube (the playlist context is kept via &list/&index).
  const ytWatchUrl = (vid, idx) => {
    if (!vid) return `https://www.youtube.com/playlist?list=${playlistId}`;
    let u = `https://www.youtube.com/watch?v=${vid}&list=${playlistId}`;
    if (idx != null) u += `&index=${idx}`;
    return u;
  };

  // Opening a lesson on YouTube marks that specific lesson watched. The module
  // is only completed once EVERY video in the playlist is watched — watching a
  // few of many lessons must NOT mark a multi-video module done.
  const onPlay = (vid) => {
    if (vid) V2_VIDEO_RESUME.markWatched(vid);
    setWatchedTick((t) => t + 1);
    const allWatched = items.length > 0 && items.every((v) => v.videoId && V2_VIDEO_RESUME.isWatched(v.videoId));
    if (canTrack && allWatched) {
      onVideoProgress({ videoId: vid, mappingId, modules, watchedRatio: 1 });
    }
  };

  const posterUrl = active?.videoId
    ? (H.youtubePoster ? H.youtubePoster(active.videoId) : `https://i.ytimg.com/vi/${active.videoId}/maxresdefault.jpg`)
    : '';

  return (
    <div className="v2-playlist-embed">
      <div className="v2-video-frame v2-video-frame--playlist">
        {!loading && items.length > 0 && active?.videoId && (
          <a
            className="v2-video-poster"
            href={ytWatchUrl(active.videoId, videoIndex)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onPlay(active.videoId)}
            aria-label={`Watch on YouTube: ${active.title || title}`}
            style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
          >
            <span className="v2-video-play" aria-hidden="true">▶</span>
          </a>
        )}
        {active?.videoId && watchedSet.has(active.videoId) && <V2WatchedBadge />}
        {/* Per-video code link — keyed by the ACTIVE video's id. */}
        <V2CodeLink videoId={active && active.videoId} />
        {loading && (
          <div className="v2-playlist-loading">Loading playlist…</div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <V2VideoActions watchUrl={ytWatchUrl(active?.videoId, videoIndex)} />
      )}

      {items.length > 0 && (
        <div className="v2-playlist-nav" aria-label="Playlist navigation">
          <button
            type="button"
            className="v2-playlist-nav-btn"
            onClick={goPrev}
            disabled={activeIdx <= 0}
            aria-label="Previous video"
          >
            ← Previous
          </button>
          <span className="v2-playlist-nav-count">
            {activeIdx + 1} / {items.length}
          </span>
          <button
            type="button"
            className="v2-playlist-nav-btn"
            onClick={goNext}
            disabled={activeIdx >= items.length - 1}
            aria-label="Next video"
          >
            Next →
          </button>
        </div>
      )}

      {items.length > 0 && active && (
        <div className="v2-playlist-now" aria-live="polite">
          <span className="v2-playlist-now-label">Featured</span>
          <span className="v2-playlist-now-title">{active.title}</span>
        </div>
      )}

      {listFailed && !loading && items.length === 0 && !hasStaticSeed && (
        <p className="v2-playlist-fallback">
          Could not load the video list.{' '}
          <a href={`https://www.youtube.com/playlist?list=${playlistId}`} target="_blank" rel="noopener noreferrer">
            Open playlist on YouTube →
          </a>
        </p>
      )}

      {items.length > 0 && (
        <div className="v2-playlist-tracks">
          <div className="v2-playlist-tracks-head">{items.length} videos in this playlist</div>
          <div className="v2-playlist-tracks-scroll" role="list" ref={scrollListRef}>
            {items.map((v, i) => (
              <a
                key={`${v.videoId}-${i}`}
                role="listitem"
                href={ytWatchUrl(v.videoId, i + 1)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { setActiveIdx(i); onPlay(v.videoId); }}
                className={`v2-playlist-track ${i === activeIdx ? 'is-active' : ''} ${watchedSet.has(v.videoId) ? 'is-watched' : ''}`}
                aria-current={i === activeIdx ? 'true' : undefined}
              >
                <img
                  className="v2-playlist-track-thumb"
                  src={H.youtubeThumbnail ? H.youtubeThumbnail(v.videoId) : `https://i.ytimg.com/vi/${v.videoId}/maxresdefault.jpg`}
                  alt=""
                  loading={i < 8 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={i < 4 ? 'high' : 'auto'}
                  onError={(e) => {
                    if (e.currentTarget.dataset.fallback) return;
                    e.currentTarget.dataset.fallback = '1';
                    e.currentTarget.src = `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`;
                  }}
                />
                <span className="v2-playlist-track-num">{i + 1}</span>
                <span className="v2-playlist-track-title">{v.title}</span>
                {watchedSet.has(v.videoId) && <span className="v2-playlist-track-check" aria-label="Watched">✓</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth gate for all video content ─────────────────────────────────────
// Subscribes to Firebase auth so EVERY video on the site stays hidden until
// the visitor is signed in (and not anonymous). Centralised here so any call
// site — hero promo, roadmap module playlists, masterclass clips — is gated
// without threading a `user` prop through every component.
function useV2AuthUser() {
  const [state, setState] = useState({ ready: false, user: null });
  useEffect(() => {
    let settled = false;
    let unsub = null;
    try {
      if (window.firebase && window.firebase.auth) {
        unsub = window.firebase.auth().onAuthStateChanged((u) => {
          settled = true;
          setState({ ready: true, user: u });
        });
      }
    } catch (e) {}
    // If Firebase never reports (SDK blocked / offline), stop blocking after a
    // short grace period and treat the visitor as signed-out (show the gate).
    const t = setTimeout(() => {
      setState((s) => (s.ready ? s : { ready: true, user: null }));
    }, 2500);
    return () => { clearTimeout(t); if (unsub) unsub(); };
  }, []);
  return state;
}

function V2VideoGate() {
  return (
    <div className="v2-video-block">
      <div className="v2-video-frame v2-video-gate">
        <div className="v2-video-gate__inner">
          <span className="v2-video-gate__lock" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <p className="v2-video-gate__title">Sign in to watch</p>
          <p className="v2-video-gate__sub">Create a free account to unlock every video on the site.</p>
          <button
            type="button"
            className="v2-video-gate__btn"
            onClick={() => { try { window.dispatchEvent(new CustomEvent('v2:open-signin')); } catch (e) {} }}
          >
            Sign in / Register
          </button>
        </div>
      </div>
    </div>
  );
}

function V2ClickToPlayVideo(props) {
  const { ready, user } = useV2AuthUser();
  const signedIn = !!(user && !user.isAnonymous);
  // While auth is resolving, hold a neutral placeholder so signed-in users
  // don't see the gate flash before their video appears.
  if (!ready) {
    return (
      <div className="v2-video-block">
        <div className="v2-video-frame v2-video-gate v2-video-gate--loading" aria-hidden="true" />
      </div>
    );
  }
  if (!signedIn) return <V2VideoGate />;
  return <V2ClickToPlayVideoInner {...props} />;
}

function V2ClickToPlayVideoInner({ videoId, playlistId, title, caption, startSec, trackable, onVideoProgress, mappingId, modules, hideCaption, codeUrl, inline }) {
  // Only the top hero videos (inline) play on-site. Every other video opens on
  // YouTube; clicking play marks it watched since we can't track completion off-site.
  if (inline && !playlistId) {
    return (
      <V2TrackableVideo
        videoId={videoId}
        title={title}
        caption={hideCaption ? null : caption}
        startSec={startSec}
        onVideoProgress={onVideoProgress}
        mappingId={mappingId}
        modules={modules}
        codeUrl={codeUrl}
      />
    );
  }
  if (playlistId) {
    return (
      <V2PlaylistEmbed
        playlistId={playlistId}
        title={title}
        onVideoProgress={onVideoProgress}
        mappingId={mappingId}
        modules={modules}
        codeUrl={codeUrl}
      />
    );
  }
  return (
    <V2RedirectVideo
      videoId={videoId}
      title={title}
      caption={hideCaption ? null : caption}
      startSec={startSec}
      onVideoProgress={onVideoProgress}
      mappingId={mappingId}
      modules={modules}
      codeUrl={codeUrl}
    />
  );
}

// A single video that opens on YouTube (poster → new tab). Clicking play marks
// it watched and completes the linked module(s) — used for all module videos.
function V2RedirectVideo({ videoId, title, caption, startSec, onVideoProgress, mappingId, modules, codeUrl }) {
  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const thumbUrl = H.youtubePoster ? H.youtubePoster(videoId) : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const watchUrl = H.youtubeWatchUrl
    ? H.youtubeWatchUrl(videoId, startSec || 0)
    : `https://www.youtube.com/watch?v=${videoId}${startSec ? `&t=${startSec}s` : ''}`;
  const [watched, setWatched] = useState(() => V2_VIDEO_RESUME.isWatched(videoId));
  const canTrack = Boolean(onVideoProgress && modules && modules.length);
  // Refresh the badge when account-synced progress arrives (other tabs/devices).
  useEffect(() => {
    const onSync = () => setWatched(V2_VIDEO_RESUME.isWatched(videoId));
    window.addEventListener('roadmap-progress-sync', onSync);
    return () => window.removeEventListener('roadmap-progress-sync', onSync);
  }, [videoId]);
  const onPlay = () => {
    V2_VIDEO_RESUME.markWatched(videoId);
    setWatched(true);
    if (canTrack) onVideoProgress({ videoId, mappingId, modules, watchedRatio: 1 });
  };
  return (
    <div className="v2-video-block">
      <div className="v2-video-frame">
        <a
          className="v2-video-poster"
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onPlay}
          aria-label={`Watch on YouTube: ${title}`}
          style={{ backgroundImage: `url(${thumbUrl})` }}
        >
          <span className="v2-video-play" aria-hidden="true">▶</span>
        </a>
        {watched && <V2WatchedBadge />}
        <V2CodeLink videoId={videoId} fallbackUrl={codeUrl} />
      </div>
      {caption && (
        <p className="v2-video-caption">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" onClick={onPlay}>{caption}</a>
        </p>
      )}
      <V2VideoActions watchUrl={watchUrl} />
    </div>
  );
}

// Mounts heavy embeds only when they scroll near the viewport, so the page
// doesn't load a YouTube iframe for every video at once. We mount the player
// (rather than a click-to-load facade) so the viewer's click lands on YouTube's
// own play button — that user-initiated play is what makes YouTube serve ads.
function useV2InView(ref, rootMargin = '300px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); obs.disconnect(); }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, inView, rootMargin]);
  return inView;
}

let _ytApiReady = null;
function ensureYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (_ytApiReady) return _ytApiReady;
  _ytApiReady = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    if (window.YT && window.YT.Player) { resolve(); return; }
    // Inject the IFrame Player API once. Without this the ready callback above
    // never fires and the player stays a black box. (id guards double-inject.)
    if (!document.getElementById('youtube-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'youtube-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      (document.head || document.body).appendChild(s);
    }
  });
  return _ytApiReady;
}

function V2TrackableVideo({ videoId, title, caption, startSec, onVideoProgress, mappingId, modules, codeUrl }) {
  const frameRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const pollRef = React.useRef(null);
  const reportedRef = React.useRef(false);
  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const thumbUrl = H.youtubePoster
    ? H.youtubePoster(videoId)
    : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const watchUrl = H.youtubeWatchUrl ? H.youtubeWatchUrl(videoId, startSec || 0) : `https://www.youtube.com/watch?v=${videoId}`;
  const threshold = H.PROGRESS_THRESHOLD || 0.8;
  const canTrack = Boolean(onVideoProgress && modules && modules.length);
  // Resume is keyed per (video, chapter) context: mappingId is unique per
  // module mapping; standalone videos (hero) fall back to videoId.
  const resumeKey = mappingId || videoId;
  const inView = useV2InView(frameRef);
  // Local resume badge is keyed by resumeKey; the account-synced flag is keyed
  // by videoId — check both so the badge matches in every tab / on every device.
  const [watched, setWatched] = useState(
    () => V2_VIDEO_RESUME.isWatched(resumeKey) || V2_VIDEO_RESUME.isWatched(videoId)
  );
  useEffect(() => {
    const onSync = () =>
      setWatched((w) => w || V2_VIDEO_RESUME.isWatched(resumeKey) || V2_VIDEO_RESUME.isWatched(videoId));
    window.addEventListener('roadmap-progress-sync', onSync);
    return () => window.removeEventListener('roadmap-progress-sync', onSync);
  }, [resumeKey, videoId]);

  useEffect(() => {
    if (!inView || !videoId) return;
    let destroyed = false;

    const startPlayer = async () => {
      await ensureYouTubeIframeAPI();
      if (destroyed || !containerRef.current) return;

      // Resume where the viewer left off (falls back to the fixed chapter start).
      const resumeSec = V2_VIDEO_RESUME.load(resumeKey);
      const startAt = resumeSec > 0 ? Math.max(resumeSec, startSec || 0) : (startSec || 0);

      // No `autoplay`: the player shows YouTube's own poster + play button, and
      // the viewer's click on it counts as user-initiated playback — the thing
      // that makes YouTube serve pre-roll ads on an embed.
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          start: startAt,
          enablejsapi: 1,
          origin: window.location.origin,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED && !reportedRef.current) {
              reportedRef.current = true;
              V2_VIDEO_RESUME.markWatched(resumeKey);
              setWatched(true);
              V2_VIDEO_RESUME.clear(resumeKey);   // finished -> start fresh next time
              if (canTrack) onVideoProgress({ videoId, mappingId, modules, watchedRatio: 1 });
            }
          },
        },
      });

      pollRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p || !p.getCurrentTime || reportedRef.current) return;
        try {
          const cur = p.getCurrentTime();
          const dur = p.getDuration();
          if (!dur || dur <= 0) return;
          if (cur / dur >= threshold) {
            // Completed: mark watched (for the badge), clear resume, report module.
            reportedRef.current = true;
            V2_VIDEO_RESUME.markWatched(resumeKey);
            setWatched(true);
            V2_VIDEO_RESUME.clear(resumeKey);
            if (canTrack) onVideoProgress({ videoId, mappingId, modules, watchedRatio: cur / dur });
          } else {
            V2_VIDEO_RESUME.save(resumeKey, cur, dur);
          }
        } catch (_) { /* player not ready */ }
      }, 5000);
    };

    startPlayer();

    return () => {
      destroyed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      // Capture the final position before tearing the player down.
      try {
        const p = playerRef.current;
        if (p && p.getCurrentTime && !reportedRef.current) {
          const cur = p.getCurrentTime();
          const dur = p.getDuration();
          if (dur > 0) V2_VIDEO_RESUME.save(resumeKey, cur, dur);
        }
      } catch (_) {}
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (_) {}
      }
      playerRef.current = null;
    };
  }, [inView, videoId, startSec, canTrack, mappingId, modules, onVideoProgress, threshold, resumeKey]);

  return (
    <div className="v2-video-block">
      <div
        className="v2-video-frame"
        ref={frameRef}
        style={{ backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {inView && <div ref={containerRef} className="v2-video-yt-player" title={title} />}
        {watched && <V2WatchedBadge />}
        <V2CodeLink videoId={videoId} fallbackUrl={codeUrl} />
      </div>
      {caption && (
        <p className="v2-video-caption">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer">{caption}</a>
        </p>
      )}
      <V2VideoActions watchUrl={watchUrl} />
    </div>
  );
}

function V2HeroSocialProof() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % V2_HERO_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const q = V2_HERO_QUOTES[idx];
  return (
    <div className="v2-hero-proof" aria-live="polite">
      <span className="v2-hero-proof-stars" aria-hidden="true">★★★★★</span>
      <span className="v2-hero-proof-text">&ldquo;{q.text}&rdquo;</span>
      <span className="v2-hero-proof-author">— {q.author}</span>
    </div>
  );
}

function V2HeroSection({ nextMc, onReserve, onRoadmap, onExploreCurriculum, reserved, onManage }) {
  const dateStr = nextMc ? formatMcShortDate(nextMc.dateTime) : 'Coming soon';
  const free = isMcFree(nextMc);
  const nextMcDate = nextMc && nextMc.dateTime ? new Date(nextMc.dateTime) : null;

  return (
    <header className="coaching-home__hero v2-hero hero--split">
      <div className="v2-hero-grid">
        {/* LEFT: copy + CTAs */}
        <div className="v2-hero-left">
          <h1 className="v2-hero-title">
            <span className="v2-hero-title-line">Learn from a builder.</span>
            <em className="v2-hero-title-em">Become one.</em>
          </h1>

          <p className="v2-hero-sub">
            Live build sessions where you ship a production-grade agent on the call —
            demo first, then we build together. Not ChatGPT tips. Not hype.
          </p>

          <p className="v2-hero-telugu">
            English + Telugu · built for Indian engineers
          </p>

          {reserved && nextMc ? (
            /* Seat already reserved — show the booked session instead of a sell */
            <div className="v2-hero-upcoming">
              <p className="v2-hero-upcoming-label">Upcoming session for you</p>
              <h3 className="v2-hero-upcoming-title">{nextMc.title}</h3>
              <p className="v2-hero-upcoming-date">
                {nextMcDate && !isNaN(nextMcDate) ? formatMcFullDateTime(nextMcDate) : 'Date TBA'}
              </p>
              <p className="v2-hero-upcoming-note">
                You&apos;re registered ✓ · Meeting link will be emailed before the masterclass
              </p>
              <div className="v2-hero-actions">
                <button type="button" className="v2-hero-cta" onClick={onManage}>
                  <span className="v2-hero-cta-text">View in my account</span>
                  <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
                </button>
                {V2_CONFIG.showHeroSecondaryCta && (
                  <button
                    type="button"
                    className="v2-hero-cta v2-hero-cta--ghost"
                    onClick={onExploreCurriculum || onRoadmap}
                  >
                    <span className="v2-hero-cta-text">Explore the Masterclass</span>
                    <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="v2-hero-actions">
                <button
                  type="button"
                  className="v2-hero-cta"
                  onClick={() => onReserve(nextMc)}
                  disabled={!nextMc}
                >
                  {nextMc ? (
                    <>
                      <span className="v2-hero-cta-text">
                        {free ? <>Reserve seat · <V2McPrice mc={nextMc} /> · {dateStr}</> : `Book my seat · ${formatMcPriceShort(nextMc)} · ${dateStr}`}
                      </span>
                      <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
                    </>
                  ) : (
                    'Next masterclass dropping soon'
                  )}
                </button>
                {V2_CONFIG.showHeroSecondaryCta && (
                  <button
                    type="button"
                    className="v2-hero-cta v2-hero-cta--ghost"
                    onClick={onExploreCurriculum || onRoadmap}
                  >
                    <span className="v2-hero-cta-text">Explore the Masterclass</span>
                    <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
                  </button>
                )}
              </div>

              {nextMc && (
                <p className="v2-hero-microcopy">
                  {free ? (
                    <>
                      <span className="v2-hero-microcopy-lock" aria-hidden="true">🎟️</span>
                      Free to attend · Meeting link emailed a few days before the masterclass +  Meeting reminders
                    </>
                  ) : (
                    <>
                      <span className="v2-hero-microcopy-lock" aria-hidden="true">🔒</span>
                      Razorpay · 100% refund within 24h
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {/* RIGHT: video */}
        <div className="v2-hero-right">
          {(() => {
            const dynamicVideoUrl = nextMc?.videoUrl || nextMc?.youtubeVideoId || nextMc?.videoId;
            let finalVideoId = V2_BRAND.roadmapVideoId;
            let isCustomVideo = false;

            if (dynamicVideoUrl) {
              const trimmed = dynamicVideoUrl.trim();
              if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
                finalVideoId = trimmed;
                isCustomVideo = true;
              } else {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = trimmed.match(regExp);
                if (match && match[2].length === 11) {
                  finalVideoId = match[2];
                  isCustomVideo = true;
                }
              }
            }

            const titleText = isCustomVideo 
              ? `${nextMc.title || "Masterclass"} Promo — Balaji Chippada` 
              : "Agentic AI Engineer Roadmap 2026 — Balaji Chippada";
            
            const captionText = isCustomVideo
              ? `Watch masterclass trailer · Watch on YouTube`
              : `99% People Learn AI Wrong · ${V2_SOCIAL.roadmapViews} views · Watch on YouTube`;

            return (
              <V2ClickToPlayVideo
                videoId={finalVideoId}
                title={titleText}
                caption={captionText}
              />
            );
          })()}
        </div>
      </div>

      {/* Anchor stat row — mirrors the roadmap hero rhythm */}
      <div className="hero__stats v2-hero-stats">
        <div>
          <div className="hero__stat-num">{V2_SOCIAL.roadmapViews}</div>
          <div className="hero__stat-label">Roadmap views</div>
        </div>
        <div>
          <div className="hero__stat-num">{V2_SOCIAL.youtubeSubs}</div>
          <div className="hero__stat-label">Subscribers</div>
        </div>
        <div>
          <div className="hero__stat-num">2hr</div>
          <div className="hero__stat-label">Live session</div>
        </div>
        <div>
          <div className="hero__stat-num">{free ? 'Free' : '24h'}</div>
          <div className="hero__stat-label">{free ? 'First class' : '100% refund'}</div>
        </div>
      </div>
    </header>
  );
}

// Thin centered testimonial band — sits between the hero and the social cards.
// No borders, no dividers — just a quote with the rotating quote component.
function V2QuoteBand() {
  return (
    <section className="v2-quote-band" aria-label="Student testimonial">
      <V2HeroSocialProof />
    </section>
  );
}

function V2BookingWizard({
  session, step, setStep, user, selectedTier, setSelectedTier,
  bookingName, setBookingName, bookingEmail, setBookingEmail, bookingPhone, setBookingPhone,
  bookingLoading, bookingError, onClose, onGoogleLogin, onSubmitPayment, onSuccess,
  successData, setActiveMainTab,
}) {
  const [stepError, setStepError] = useState('');
  // Free seats are reserved for our YouTube community — viewers subscribe before
  // they can confirm. We can't verify a subscription server-side, so we open the
  // channel and require an explicit confirmation.
  const [ytVisited, setYtVisited] = useState(false);
  const [ytSubscribed, setYtSubscribed] = useState(false);
  if (!session) return null;
  const tiers = getMcTiers(session);
  const tier = selectedTier || tiers[0];
  const price = typeof tier?.price === 'number' ? tier.price : getMcPrice(session);
  const free = price === 0;

  if (successData) {
    const start = session.dateTime ? new Date(session.dateTime) : new Date();
    const end = new Date(start.getTime() + (session.duration || 180) * 60000);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container v2-booking-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Booking confirmed">
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="v2-booking-success">
            <div className="v2-success-icon">✅</div>
            <h2 className="modal-title">{successData.alreadyRegistered ? 'Already registered ✓' : "You're in!"}</h2>
            <p className="modal-desc"><strong>{session.title}</strong><br />{formatMcFullDateTime(session.dateTime)}</p>
            <p className="v2-booking-hint" style={{ marginTop: '8px' }}>
              {successData.alreadyRegistered
                ? <>You&apos;re already registered for this masterclass with <strong>{bookingEmail}</strong>. Meeting link emailed a few days before the masterclass +  Meeting reminders.</>
                : <>Confirmation sent to <strong>{bookingEmail}</strong>. Meeting link emailed a few days before the masterclass +  Meeting reminders.</>}
            </p>
            <div className="v2-success-actions">
              <button type="button" className="form-btn" onClick={() => generateICS({
                title: session.title, startDate: start, endDate: end,
                description: `Masterclass with Balaji Chippada. Meeting link emailed a few days before the masterclass +  Meeting reminders.`,
                location: session.zoomLink || 'Online',
              })}>📅 Add to Calendar</button>
              <a href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer" className="form-btn v2-btn-secondary">
                💬 Join WhatsApp Community
              </a>
              {!user || user.isAnonymous ? (
                <button type="button" className="form-btn v2-btn-secondary" onClick={onGoogleLogin} disabled={bookingLoading}>
                  Save my booking · Sign in with Google
                </button>
              ) : (
                <button type="button" className="form-btn v2-btn-secondary" onClick={() => { onClose(); setActiveMainTab('mybookings'); }}>
                  Go to My Account →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container v2-booking-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reserve your seat">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {!free && (
          <div className="v2-step-indicator">
            <span className={step >= 1 ? 'active' : ''}>① Your details</span>
            <span>→</span>
            <span className={step >= 2 ? 'active' : ''}>② Pay securely</span>
          </div>
        )}

        <h2 className="modal-title">{free ? 'Reserve your free seat' : 'Reserve your seat'}</h2>
        <p className="modal-desc">
          <strong>{session.title}</strong><br />
          {formatMcFullDateTime(session.dateTime)}
        </p>

        {bookingError && (
          <div className="status-box status-box--error" style={{ padding: '12px 16px', marginBottom: '16px' }}>
            <span>⚠</span><span>{bookingError}</span>
          </div>
        )}

        {step === 1 && (
          <form className="v2-booking-step" onSubmit={(e) => {
            e.preventDefault();
            const nameErr = V2_VALIDATE.nameError(bookingName);
            if (nameErr) { setStepError(nameErr); return; }
            const emailErr = V2_VALIDATE.emailError(bookingEmail);
            if (emailErr) { setStepError(emailErr); return; }
            const phoneErr = V2_VALIDATE.phoneError(bookingPhone, true);
            if (phoneErr) { setStepError(phoneErr); return; }
            if (free && !ytSubscribed) {
              setStepError('Please subscribe on YouTube to reserve your free seat.');
              return;
            }
            setStepError('');
            // FREE → submit straight from this form. PAID → continue to payment step.
            if (free) {
              onSubmitPayment();
            } else {
              setStep(2);
            }
          }}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                type="text"
                className="form-input"
                value={bookingName}
                onChange={(e) => setBookingName(V2_VALIDATE.cleanName(e.target.value))}
                placeholder="Your name on the certificate"
                autoComplete="name"
                maxLength={60}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={bookingEmail}
                onChange={(e) => setBookingEmail(e.target.value)}
                placeholder="you@gmail.com"
                autoComplete="email"
                inputMode="email"
                maxLength={120}
                required
                readOnly={!!(user && !user.isAnonymous && bookingEmail)}
                aria-readonly={!!(user && !user.isAnonymous && bookingEmail)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone <span className="form-label-hint">(for WhatsApp reminders &amp; meeting link)</span></label>
              <V2PhoneField value={bookingPhone} onChange={setBookingPhone} required />
            </div>

            <div className="v2-order-summary">
              <div className="v2-order-summary-row">
                <span>One live session · 2 hours · recording included</span>
                <span className="v2-order-price"><V2McPrice mc={session} /></span>
              </div>
            </div>

            {free && (
              <div className="v2-yt-gate">
                <div className="v2-yt-gate-head">
                  <span className="v2-yt-gate-icon" aria-hidden="true">▶</span>
                  <span>Free seats are for our YouTube community — subscribe to unlock yours.</span>
                </div>
                <a
                  className="v2-yt-gate-btn"
                  href={`${V2_BRAND.youtubeChannel}?sub_confirmation=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setYtVisited(true)}
                >
                  ▶ Subscribe on YouTube
                </a>
                <p style={{ fontSize: '12px', color: 'var(--fg-dim)', margin: '6px 0 0' }}>
                  Click on this button even if you're subscribed.
                </p>
                <label className={`v2-yt-gate-check${ytVisited ? '' : ' is-disabled'}`}>
                  <input
                    type="checkbox"
                    checked={ytSubscribed}
                    disabled={!ytVisited}
                    onChange={(e) => setYtSubscribed(e.target.checked)}
                  />
                  <span>{ytVisited ? "I've subscribed on YouTube" : 'Tap “Subscribe” first, then confirm here'}</span>
                </label>
              </div>
            )}

            {(stepError || bookingError) && (
              <p className="v2-booking-error" role="alert" style={{ color: 'var(--c-rust)', fontSize: '13px', margin: '4px 0 0' }}>
                {stepError || bookingError}
              </p>
            )}
            <button type="submit" className="form-btn v2-pay-btn" disabled={bookingLoading || (free && !ytSubscribed)}>
              {free
                ? (bookingLoading ? 'Reserving…' : 'Confirm my free seat →')
                : 'Continue to payment →'}
            </button>
            <p className="v2-booking-hint">
              {free
                ? 'No payment, no account needed. Meeting link emailed a few days before the masterclass +  Meeting reminders.'
                : 'No account needed. Meeting link emailed a few days before the masterclass +  Meeting reminders.'}
            </p>
          </form>
        )}

        {step === 2 && !free && (
          <div className="v2-booking-step">
            <div className="v2-order-summary">
              <div className="v2-order-summary-row">
                <span><strong>{session.title}</strong></span>
                <span className="v2-order-price">₹{price.toLocaleString()}</span>
              </div>
              <div className="v2-order-summary-sub">
                {formatMcFullDateTime(session.dateTime)}
              </div>
              <div className="v2-order-summary-sub">
                {bookingName} · {bookingEmail}
              </div>
            </div>
            <button type="button" className="form-btn v2-pay-btn" disabled={bookingLoading} onClick={onSubmitPayment}>
              {bookingLoading ? 'Processing…' : `Pay ₹${price.toLocaleString()} securely →`}
            </button>
            <p className="v2-booking-hint">🔒 Razorpay · UPI · card · netbanking · 100% refund within 24h</p>
            <button type="button" className="v2-modal-back" onClick={() => setStep(1)}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

function V2StudentDashboard({ user, db, onReserve, onGoToRoadmap, roadmapProgress, deletedSessionIds }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [inquiry, setInquiry] = useState('');
  const [inquirySent, setInquirySent] = useState(false);

  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const progress = H.calcRoadmapProgress
    ? H.calcRoadmapProgress(roadmapProgress?.completedModules || [])
    : { phaseStats: [], overallPct: 0, totalDone: 0, totalModules: 0 };
  const nextModule = H.findNextModule
    ? H.findNextModule(roadmapProgress?.completedModules || [])
    : null;
  const updatedAt = roadmapProgress?.updatedAt?.toDate
    ? roadmapProgress.updatedAt.toDate()
    : (roadmapProgress?.updatedAt ? new Date(roadmapProgress.updatedAt) : null);
  const accountName = (profileName || user?.displayName || '').trim();
  const displayName = accountName || 'Learner';
  const firstName = displayName.split(/\s+/)[0] || 'Learner';
  const accountEmail = user?.email || 'Signed in';

  useEffect(() => {
    if (!db || !user) { setLoading(false); return; }
    const unsub = db.collection('users').doc(user.uid).collection('bookings')
      .orderBy('bookedAt', 'desc')
      .onSnapshot((snap) => {
        const list = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setBookings(list);
        setLoading(false);
      }, () => {
        db.collection('registrations').where('studentEmail', '==', user.email).get().then((snap) => {
          const list = [];
          snap.forEach((doc) => list.push({ id: doc.id, ...doc.data(), masterclassTitle: doc.data().sessionTitle }));
          setBookings(list);
          setLoading(false);
        }).catch(() => setLoading(false));
      });
    return () => unsub();
  }, [user, db]);

  useEffect(() => {
    if (!db || !user) return;
    db.collection('users').doc(user.uid).get().then((doc) => {
      if (doc.exists) {
        setProfileName(doc.data().name || user.displayName || '');
        setProfilePhone(doc.data().phone || '');
      }
    });
  }, [user, db]);

  const now = Date.now();
  // A booking is a snapshot taken at reservation time; if the admin later deletes
  // the masterclass, hide it so students don't see a cancelled session.
  const isDeleted = (b) => !!(deletedSessionIds && deletedSessionIds.has(b.masterclassId || b.sessionId)) || b.status === 'cancelled' || b.deleted === true;
  // Collapse duplicate booking docs for the same class so a student who booked
  // more than once doesn't see the session listed twice. Bookings load newest-
  // first, so the first occurrence we keep is the most recent.
  const seenClass = new Set();
  const liveBookings = bookings.filter((b) => !isDeleted(b)).filter((b) => {
    const key = b.masterclassId || b.sessionId || b.id;
    if (seenClass.has(key)) return false;
    seenClass.add(key);
    return true;
  });
  const totalClasses = liveBookings.length;
  const upcoming = liveBookings.filter((b) => {
    const d = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
    return b.status === 'confirmed' || b.status === 'completed' ? (d ? d.getTime() >= now - 3600000 : true) : false;
  });
  const past = liveBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').filter((b) => {
    const d = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
    return d && d.getTime() < now - 3600000;
  });

  const saveProfile = async () => {
    if (!db || !user) return;
    const nameErr = V2_VALIDATE.nameError(profileName);
    if (nameErr) { setProfileError(nameErr); return; }
    const phoneErr = V2_VALIDATE.phoneError(profilePhone, false);
    if (phoneErr) { setProfileError(phoneErr); return; }
    setProfileError('');
    setSaving(true);
    await db.collection('users').doc(user.uid).set({ name: profileName.trim(), phone: V2_VALIDATE.toE164(profilePhone) }, { merge: true });
    setSaving(false);
  };

  const submitInquiry = async () => {
    if (!db || !user || !inquiry.trim()) return;
    await db.collection('inquiries').add({
      userId: user.uid, email: user.email, message: inquiry.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setInquiry('');
    setInquirySent(true);
  };

  if (loading) return <div className="v2-dashboard"><p className="v2-dashboard-loading">Loading your masterclasses…</p></div>;

  return (
    <div className="v2-dashboard">
      <header className="v2-account-hero">
        <div className="v2-account-hero-copy">
          <span className="v2-account-eyebrow">My Account</span>
          <h1 className="v2-dashboard-title">Welcome back, <em>{firstName}</em>.</h1>
          <p className="v2-account-sub">Track your roadmap, manage masterclasses, and keep your profile ready for live sessions.</p>
        </div>
        <div className="v2-account-identity" aria-label="Signed in account">
          <span className="v2-account-avatar" aria-hidden="true">{firstName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <span>{accountEmail}</span>
          </div>
        </div>
      </header>

      <div className="v2-account-stats" aria-label="Account summary">
        <div className="v2-account-stat">
          <span className="v2-account-stat-num">{progress.overallPct}%</span>
          <span className="v2-account-stat-label">Roadmap complete</span>
        </div>
        <div className="v2-account-stat">
          <span className="v2-account-stat-num">{upcoming.length}</span>
          <span className="v2-account-stat-label">Upcoming sessions</span>
        </div>
        <div className="v2-account-stat">
          <span className="v2-account-stat-num">{totalClasses}</span>
          <span className="v2-account-stat-label">Total bookings</span>
        </div>
      </div>

      <section className="v2-dash-section v2-roadmap-dash v2-account-card">
        <h2>My Roadmap Progress</h2>
        {roadmapProgress?.startedAt ? (
          <>
            <div className="v2-roadmap-overall">
              <div className="v2-roadmap-ring" style={{ '--pct': progress.overallPct }}>
                <span className="v2-roadmap-ring-num">{progress.overallPct}%</span>
              </div>
              <div className="v2-roadmap-overall-meta">
                <p>{progress.totalDone} of {progress.totalModules} modules complete</p>
                {updatedAt && (
                  <p className="v2-roadmap-updated">Last activity · {updatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
                {nextModule && onGoToRoadmap && (
                  <button type="button" className="form-btn v2-roadmap-continue" onClick={() => onGoToRoadmap(nextModule)}>
                    Continue · Phase {String(nextModule.phaseId).padStart(2, '0')} · Module {nextModule.moduleN}
                  </button>
                )}
                {!nextModule && <p className="v2-success-msg">You&apos;ve completed every module. Ship a capstone!</p>}
              </div>
            </div>
            <div className="v2-roadmap-phase-bars">
              {progress.phaseStats.map((ps) => (
                <div key={ps.phaseId} className="v2-roadmap-phase-row">
                  <span className="v2-roadmap-phase-label">Ph {String(ps.phaseId).padStart(2, '0')}</span>
                  <div className="v2-roadmap-phase-track">
                    <div className="v2-roadmap-phase-fill" style={{ width: `${ps.pct}%` }} />
                  </div>
                  <span className="v2-roadmap-phase-pct">{ps.pct}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="v2-empty">
            You haven&apos;t started tracking yet.{' '}
            {onGoToRoadmap && (
              <button type="button" className="v2-link-btn" onClick={() => onGoToRoadmap(null)}>Start on the Full Roadmap →</button>
            )}
          </p>
        )}
      </section>

      <h2 className="v2-dashboard-subtitle">My Masterclasses</h2>
      <section className="v2-dash-section v2-account-card">
        <h2>Upcoming Sessions</h2>
        {upcoming.length === 0 ? (
          <p className="v2-empty">No upcoming sessions. <button type="button" className="v2-link-btn" onClick={() => { window.scrollTo({ top: 0 }); onReserve && onReserve(); }}>Browse masterclasses</button></p>
        ) : upcoming.map((b) => {
          const sessionDate = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
          const minsUntil = sessionDate ? (sessionDate.getTime() - now) / 60000 : 9999;
          const canJoin = minsUntil <= 15 && minsUntil >= -30 && b.zoomLink;
          return (
            <div key={b.id} className="v2-session-card upcoming">
              {minsUntil <= 1440 && minsUntil > 0 && <div className="v2-live-badge">Starts in {Math.round(minsUntil)} min</div>}
              <div className="v2-session-card-meta">Confirmed seat</div>
              <h3>{b.masterclassTitle || b.sessionTitle}</h3>
              <p>{sessionDate ? formatMcFullDateTime(sessionDate) : 'Date TBA'}</p>
              <div className="v2-session-actions">
                {canJoin && b.zoomLink && <a href={b.zoomLink} target="_blank" rel="noopener noreferrer" className="form-btn">Join Live →</a>}
                {sessionDate && (
                  <button type="button" className="v2-btn-secondary" onClick={() => generateICS({
                    title: b.masterclassTitle || b.sessionTitle,
                    startDate: sessionDate,
                    endDate: new Date(sessionDate.getTime() + 180 * 60000),
                    location: b.zoomLink || 'Online',
                  })}>Add to Calendar</button>
                )}
                {b.prepPdfUrl && <a href={b.prepPdfUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Prep Guide</a>}
              </div>
            </div>
          );
        })}
      </section>
      <section className="v2-dash-section v2-account-card">
        <h2>Past Sessions</h2>
        {past.length === 0 ? <p className="v2-empty">No past sessions yet.</p> : past.map((b) => (
          <div key={b.id} className="v2-session-card">
            <div className="v2-session-card-meta">Completed session</div>
            <h3>{b.masterclassTitle || b.sessionTitle}</h3>
            <div className="v2-session-actions">
              {b.recordingUrl && <a href={b.recordingUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Watch Recording</a>}
              {b.slidesUrl && <a href={b.slidesUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Download Slides</a>}
            </div>
          </div>
        ))}
      </section>
      <div className="v2-account-support-grid">
        <section className="v2-dash-section v2-account-card">
          <h2>Profile</h2>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={profileName} onChange={(e) => setProfileName(V2_VALIDATE.cleanName(e.target.value))} maxLength={60} /></div>
          <div className="form-group"><label className="form-label">Phone</label><V2PhoneField value={profilePhone} onChange={setProfilePhone} /></div>
          {profileError && <p className="status-box status-box--error" style={{ margin: '0 0 12px', padding: '10px 14px' }}>{profileError}</p>}
          <button type="button" className="form-btn" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
        </section>
        <section className="v2-dash-section v2-account-card">
          <h2>Ask a Question</h2>
          <textarea className="form-input" rows={3} placeholder="Submit a question for an upcoming session…" value={inquiry} onChange={(e) => setInquiry(e.target.value)} />
          <button type="button" className="form-btn" style={{ marginTop: '12px' }} onClick={submitInquiry} disabled={!inquiry.trim()}>Submit Inquiry</button>
          {inquirySent && <p className="v2-success-msg">Question submitted! We&apos;ll respond before your session.</p>}
        </section>
      </div>
    </div>
  );
}

// ===============================================================
// Lead Capture Persistence & UI Components
// ===============================================================
async function saveLead({ name, email, source }) {
  if (typeof window === 'undefined' || !window.firebase) {
    console.warn('[LEAD] Firebase SDK not loaded');
    return false;
  }
  try {
    const db = window.firebase.firestore();
    const utm = V2_UTM_HELPERS.getStored();
    const payload = Object.assign({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      source: source || 'unknown',
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }, utm);

    await db.collection('leads').add(payload);
    console.log('[LEAD] Persisted successfully:', payload);
    return true;
  } catch (err) {
    console.error('[LEAD] Persistence failed:', err);
    throw err;
  }
}
window.saveLead = saveLead;

function V2LeadCaptureModal({ open, onClose, onSuccess, source, downloadUrl }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameErr = V2_VALIDATE.nameError(name);
    if (nameErr) { setError(nameErr); return; }
    const emailErr = V2_VALIDATE.emailError(email);
    if (emailErr) { setError(emailErr); return; }
    setLoading(true);
    setError('');

    try {
      await saveLead({ name, email, source: source || 'modal_download' });
      
      // Auto-trigger download/redirect if URL is passed
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }

      onSuccess && onSuccess({ name, email });
      onClose();
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Access the AI roadmap">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">×</button>
        <h3 className="modal-title">Get the <em>26-Week AI Roadmap</em></h3>
        <p className="modal-desc">
          Enter your name and email to access the full curriculum and receive weekly phase study guides.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Balaji Chippada"
              value={name}
              onChange={e => setName(V2_VALIDATE.cleanName(e.target.value))}
              autoComplete="name"
              maxLength={60}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="e.g. balaji@example.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              autoComplete="email"
              inputMode="email"
              required 
            />
          </div>
          {error && <p className="status-box status-box--error" style={{ margin: 0, padding: '10px 14px' }}>{error}</p>}
          <button type="submit" className="form-btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Get instant access'}
          </button>
        </form>
      </div>
    </div>
  );
}
window.V2LeadCaptureModal = V2LeadCaptureModal;

function V2RoadmapTeaser({ onRoadmap, onLeadCapture }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phases = (window.ROADMAP || []).slice(0, 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameErr = V2_VALIDATE.nameError(name);
    if (nameErr) { setError(nameErr); return; }
    const emailErr = V2_VALIDATE.emailError(email);
    if (emailErr) { setError(emailErr); return; }
    setLoading(true);
    setError('');

    try {
      await saveLead({ name, email, source: 'roadmap_teaser' });
      setSent(true);
      setName('');
      setEmail('');
      onLeadCapture && onLeadCapture({ name, email });
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="v2-roadmap-teaser">
      <h2>The roadmap {V2_SOCIAL.roadmapViews} engineers watched</h2>
      <p>26 weeks · 9 phases · 60+ modules · 3 production capstones · free &amp; open source</p>
      <div className="v2-phase-previews">
        {phases.map((p) => (
          <div key={p.id} className="v2-phase-preview">
            <span className="v2-phase-num">Phase {String(p.id).padStart(2, '0')}</span>
            <strong>{p.title}</strong>
            <span>{p.weeks}</span>
          </div>
        ))}
      </div>
      <div className="v2-teaser-actions">
        <button className="hero__secondary-cta" onClick={onRoadmap}>Explore the full roadmap →</button>
        <a className="hero__secondary-cta" href={V2_ROADMAP_URL} target="_blank" rel="noopener noreferrer">Open roadmap website</a>
        <a className="hero__secondary-cta" href={V2_BRAND.roadmapVideoUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
      </div>
      <form className="v2-email-capture" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
          <input
            type="text"
            id="notify-name"
            name="name"
            aria-label="Your name"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(V2_VALIDATE.cleanName(e.target.value))}
            autoComplete="name"
            maxLength={60}
            required
            disabled={sent || loading}
            style={{ flex: '1 1 200px' }}
          />
          <input
            type="email"
            id="notify-email"
            name="email"
            aria-label="Your email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
            disabled={sent || loading}
            style={{ flex: '1 1 200px' }}
          />
          <button 
            type="submit" 
            className="form-btn" 
            disabled={loading || sent} 
            style={{ flex: '1 1 150px', margin: 0 }}
          >
            {sent ? '✓ Subscribed!' : loading ? 'Submitting...' : 'Notify me'}
          </button>
        </div>
      </form>
      {error && <p className="v2-error-msg" style={{ marginTop: '12px' }}>{error}</p>}
    </section>
  );
}
window.V2RoadmapTeaser = V2RoadmapTeaser;

function V2FAQSection({ onLegal }) {
  const [open, setOpen] = useState(0);
  const faqs = (_SC.faqs && _SC.faqs.length) ? _SC.faqs : [
    { q: "I'm a beginner — is this too advanced?", a: "If you can write Python and use a terminal — Phase 1 of the free roadmap — you're ready." },
    { q: "What's the refund policy?", a: '100% refund within 24 hours of purchase, no questions asked.', link: 'refund' },
  ];

  return (
    <section className="v2-faq" id="v2-faq">
      <V2SectionHeader
        eyebrow="Got questions?"
        plain="Frequently asked"
        em="questions."
      />
      <div className="v2-faq-list">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`v2-faq-card ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="v2-faq-q"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
              >
                <span className="v2-faq-q-text">{f.q}</span>
                <span className="v2-faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
              {/* Answer stays in the DOM always (hidden via CSS when closed) so
                  search engines and AI crawlers extract every Q&A, not just the
                  open one. */}
              <div className="v2-faq-a" hidden={!isOpen}>
                <p>{f.a}</p>
                {f.link && (
                  <button type="button" className="v2-link-btn" onClick={() => onLegal(f.link)}>
                    Read full policy →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// V2WhoThisIsFor + V2BigNumbers removed — components were defined but never
// rendered (confirmed dead code in the v47 review). FAQ already answers
// "who is this for?" more naturally.

// Top promo banner — ByteByteGo style, dismissible.
// Dismissal is keyed to the masterclass id, so a new masterclass shows a fresh banner.
function V2TopBanner({ nextMc, onReserve, canShow = true }) {
  const bannerKey = nextMc ? `v2_top_banner_dismissed:${nextMc.id || 'default'}` : null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!bannerKey) return;
    try {
      setDismissed(localStorage.getItem(bannerKey) === '1');
    } catch (e) {
      setDismissed(false);
    }
  }, [bannerKey]);

  useEffect(() => {
    if (canShow && !dismissed && nextMc) {
      document.body.classList.add('has-promo-banner');
    } else {
      document.body.classList.remove('has-promo-banner');
    }
    return () => document.body.classList.remove('has-promo-banner');
  }, [canShow, dismissed, nextMc]);

  // Dev escape hatch: window.resetPromoBanner() un-dismisses the current banner.
  useEffect(() => {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return undefined;
    window.resetPromoBanner = () => {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('v2_top_banner_dismissed')) localStorage.removeItem(k);
        });
      } catch (e) {}
      setDismissed(false);
      console.log('[banner] reset — banner should reappear');
    };
    return () => { delete window.resetPromoBanner; };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { if (bannerKey) localStorage.setItem(bannerKey, '1'); } catch (e) {}
  };

  if (!canShow || dismissed || !nextMc) return null;
  const dateStr = formatMcShortDate(nextMc.dateTime);
  const free = isMcFree(nextMc);
  const titleShort = (nextMc.title || 'Live Masterclass').split(' ').slice(0, 3).join(' ');

  return (
    <div className="v2-top-banner" role="region" aria-label="Enrollment announcement">
      <div className="v2-top-banner-inner">
        <span className="v2-top-banner-badge">{free ? 'FREE WEBINAR' : 'NOW ENROLLING'}</span>
        <span className="v2-top-banner-text">
          <span className="v2-top-banner-lead">Learn by doing — </span>
          <strong>{titleShort}</strong> · {dateStr}
          <span className="v2-top-banner-price"> · <V2McPrice mc={nextMc} /></span>
        </span>
        <button type="button" className="v2-top-banner-cta" onClick={() => onReserve(nextMc)}>
          <span className="v2-top-banner-cta-full">{free ? <>Reserve seat · <V2McPrice mc={nextMc} /> →</> : 'Enroll now →'}</span>
          <span className="v2-top-banner-cta-short">{free ? 'Reserve →' : 'Enroll →'}</span>
        </button>
      </div>
      <button type="button" className="v2-top-banner-close" onClick={handleDismiss} aria-label="Dismiss banner">×</button>
    </div>
  );
}

// Real social icon cards — bigger, equal-height, click-to-follow.
function V2SocialIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };
  if (name === 'youtube') {
    return (
      <svg {...common}>
        <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
      </svg>
    );
  }
  if (name === 'linkedin') {
    return (
      <svg {...common}>
        <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
      </svg>
    );
  }
  if (name === 'github') {
    return (
      <svg {...common}>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2c-3.2.69-3.87-1.34-3.87-1.34-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.05.78 2.12v3.14c0 .3.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }
  if (name === 'instagram') {
    return (
      <svg {...common}>
        <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
      </svg>
    );
  }
  return null;
}

// Live countdown to a date — used in the welcome popup.
function V2Countdown({ dateTime }) {
  const computeRemaining = () => {
    if (!dateTime) return null;
    const ms = new Date(dateTime).getTime() - Date.now();
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
    return {
      days: Math.floor(ms / 86400000),
      hours: Math.floor((ms % 86400000) / 3600000),
      minutes: Math.floor((ms % 3600000) / 60000),
      seconds: Math.floor((ms % 60000) / 1000),
      past: false,
    };
  };
  const [t, setT] = useState(computeRemaining);
  useEffect(() => {
    const id = setInterval(() => setT(computeRemaining()), 1000);
    return () => clearInterval(id);
  }, [dateTime]);
  if (!t) return null;
  if (t.past) return <div className="v2-countdown-past">Live now or just wrapped — check the schedule.</div>;
  return (
    <div className="v2-countdown">
      <div className="v2-countdown-label">Starts in</div>
      <div className="v2-countdown-cells">
        {[
          { v: t.days, l: 'DAYS' },
          { v: t.hours, l: 'HRS' },
          { v: t.minutes, l: 'MIN' },
          { v: t.seconds, l: 'SEC' },
        ].map((cell) => (
          <div key={cell.l} className="v2-countdown-cell">
            <div className="v2-countdown-num">{String(cell.v).padStart(2, '0')}</div>
            <div className="v2-countdown-unit">{cell.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Auto-show modal on first visit per masterclass. Two-view: summary → details.
// Inspired by Krish Naik's webinar popup. Per-mc storage key.
function V2WelcomePopup({ nextMc, onReserve, onResolve }) {
  // NOTE: all hooks must run on every render — never early-return above them.
  // `nextMc` arrives async (null → object), so a conditional return here would
  // change the hook count and crash React ("rendered more hooks than previous").
  const merged = nextMc ? mergeMcWithConfig(nextMc) : null;
  const popupKey = merged ? `v2_welcome_popup_dismissed:${merged.id || 'default'}` : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('summary'); // 'summary' | 'details'

  // Keep the latest onResolve without re-triggering effects.
  const resolveRef = React.useRef(onResolve);
  resolveRef.current = onResolve;
  const resolve = () => { try { resolveRef.current && resolveRef.current(); } catch (e) {} };

  // IMPORTANT: depend only on the STABLE popupKey (a string), NOT on `merged`.
  // `merged` is a fresh object on every render — including it would clear/reset
  // the 1.8s timer on every Firestore/auth re-render, so the popup would never
  // get to open. The popupKey is derived from merged.id which only changes when
  // the actual masterclass changes.
  useEffect(() => {
    // Nothing to show (disabled / no masterclass) → hand off to the banner now.
    if (!V2_CONFIG.showWelcomePopup || !popupKey) { resolve(); return undefined; }
    let dismissed = false;
    try { dismissed = localStorage.getItem(popupKey) === '1'; } catch (e) {}
    // Already closed on a prior visit → skip straight to the banner. Also close
    // it if it slipped open under a fallback key before the real masterclass id
    // resolved (otherwise a dismissed popup could re-appear on slow loads).
    if (dismissed) { setOpen(false); resolve(); return undefined; }
    const id = setTimeout(() => setOpen(true), V2_CONFIG.welcomePopupDelayMs);
    return () => clearTimeout(id);
  }, [popupKey]);

  // Dev escape hatch — same pattern as the banner reset.
  useEffect(() => {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return undefined;
    window.resetWelcomePopup = () => {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('v2_welcome_popup_dismissed')) localStorage.removeItem(k);
        });
      } catch (e) {}
      setView('summary');
      setOpen(true);
      console.log('[popup] reset — popup should reappear');
    };
    return () => { delete window.resetWelcomePopup; };
  }, []);

  // Lock body scroll while popup is open so the page underneath doesn't bleed.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes the welcome popup (and hands off to the banner).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      setView('summary');
      try { if (popupKey) localStorage.setItem(popupKey, '1'); } catch (err) {}
      resolve();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, popupKey]);

  const dismiss = () => {
    setOpen(false);
    setView('summary');
    try { if (popupKey) localStorage.setItem(popupKey, '1'); } catch (e) {}
    resolve(); // let the promo banner take over
  };

  const register = () => {
    setOpen(false);
    try { if (popupKey) localStorage.setItem(popupKey, '1'); } catch (e) {}
    resolve(); // banner can show after the booking flow opens
    onReserve(nextMc); // pass the original mc so booking flow gets the live state
  };

  if (!open || !merged) return null;
  const free = isMcFree(merged);
  const wp = (_SC.welcomePopup || {});
  const livePill = wp.livePillLabel || (free ? 'FREE WEBINAR' : 'PAID COHORT');
  const instructor = merged.instructor || V2_INSTRUCTOR;
  const instName = typeof instructor.name === 'string' ? instructor.name : 'Balaji Chippada';
  const initials = instName.split(' ').map((s) => s[0]).slice(0, 2).join('');

  // Poster: real image when provided, else gradient block.
  const poster = merged.thumbnail ? (
    <div className="v2-welcome-poster v2-welcome-poster--image" style={{ backgroundImage: `url(${merged.thumbnail})` }}>
      <span className="v2-welcome-live">LIVE · {livePill}</span>
    </div>
  ) : (
    <div className="v2-welcome-poster">
      <span className="v2-welcome-live">LIVE · {livePill}</span>
      <div className="v2-welcome-poster-title">{(merged.title || 'Live Masterclass').toUpperCase()}</div>
      <div className="v2-welcome-poster-sub">Live with {V2_BRAND.name} · Demo first, then we build</div>
    </div>
  );

  return (
    <div className="v2-welcome-overlay" onClick={dismiss}>
      <div className={`v2-welcome-modal v2-welcome-modal--${view}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live masterclass">
        <button type="button" className="v2-welcome-close" onClick={dismiss} aria-label="Close">×</button>

        {poster}

        {view === 'summary' && (
          <div className="v2-welcome-body">
            <span className="v2-welcome-eyebrow">Next live masterclass</span>
            <h2 className="v2-welcome-title">{merged.title}</h2>
            {merged.subtitle && <p className="v2-welcome-subtitle">{merged.subtitle}</p>}
            <div className="v2-welcome-meta">
              <span>📅 {formatMcFullDateTime(merged.dateTime)}</span>
              {merged.duration && <span> · ⏱ {merged.duration} min</span>}
            </div>
            <V2Countdown dateTime={merged.dateTime} />
            <div className="v2-welcome-actions">
              <button type="button" className="v2-welcome-primary" onClick={() => setView('details')}>
                {wp.primaryCtaSummary || 'View details & register'} →
              </button>
              <button type="button" className="v2-welcome-secondary" onClick={dismiss}>
                {wp.dismissLabel || 'Maybe later'}
              </button>
            </div>
          </div>
        )}

        {view === 'details' && (
          <div className="v2-welcome-body v2-welcome-details">
            <button type="button" className="v2-welcome-back" onClick={() => setView('summary')}>← Back</button>
            <h2 className="v2-welcome-title">{merged.title}</h2>

            <div className="v2-welcome-meta-row">
              <span className="v2-welcome-chip">📅 {formatMcShortDate(merged.dateTime)}</span>
              <span className="v2-welcome-chip">⏱ {merged.duration || 180} min</span>
              <span className="v2-welcome-chip v2-welcome-chip--accent">{free ? <>🎟️ <V2McPrice mc={merged} /></> : formatMcPriceShort(merged)}</span>
            </div>

            {/* Instructor */}
            <div className="v2-welcome-section-label">Instructor</div>
            <div className="v2-welcome-instructor">
              {instructor.photo ? (
                <img className="v2-welcome-instructor-photo" src={instructor.photo} alt={instructor.name} loading="lazy" decoding="async" />
              ) : (
                <div className="v2-welcome-instructor-photo v2-welcome-instructor-photo--initials">{initials}</div>
              )}
              <div className="v2-welcome-instructor-text">
                <div className="v2-welcome-instructor-name">{instructor.name}</div>
                <div className="v2-welcome-instructor-title">{instructor.title}</div>
              </div>
              {instructor.linkedin && (
                <a className="v2-welcome-instructor-link" href={instructor.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>
              )}
            </div>

            {/* About */}
            {merged.about && (
              <>
                <div className="v2-welcome-section-label">About this masterclass</div>
                <p className="v2-welcome-prose">{merged.about}</p>
              </>
            )}

            {/* What we'll cover */}
            {Array.isArray(merged.learnings) && merged.learnings.length > 0 && (
              <>
                <div className="v2-welcome-section-label">What we&apos;ll cover</div>
                <ul className="v2-welcome-checks">
                  {merged.learnings.map((line, i) => (
                    <li key={i}><span className="v2-welcome-check">✓</span>{line}</li>
                  ))}
                </ul>
              </>
            )}

            <V2Countdown dateTime={merged.dateTime} />

            <div className="v2-welcome-actions">
              <button type="button" className="v2-welcome-primary" onClick={register}>
                {free ? <>Reserve seat · <V2McPrice mc={merged} /></> : (wp.primaryCtaDetails || 'Reserve my seat')} →
              </button>
              <button type="button" className="v2-welcome-secondary" onClick={dismiss}>
                {wp.dismissLabel || 'Maybe later'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "Three steps to your seat" explainer — adapts copy for free vs paid.
function V2HowItWorks({ nextMc }) {
  const free = isMcFree(nextMc);
  const steps = [
    {
      n: '01',
      title: 'Pick a masterclass',
      body: 'Curated, focused topics — no endless catalog. Read the syllabus and outcome.',
    },
    {
      n: '02',
      title: free ? 'Reserve free' : 'Reserve & pay',
      body: free
        ? 'Drop your name and email. We hold your seat instantly — no payment, no account needed.'
        : 'Pay securely via Razorpay. Meeting link emailed a few days before the masterclass +  Meeting reminders.',
    },
    {
      n: '03',
      title: 'Show up & build',
      body: 'Join live, build alongside Balaji, ask questions in real time, get the recording.',
    },
  ];
  return (
    <section className="v2-howitworks" aria-label="How it works">
      <V2SectionHeader
        eyebrow="How it works"
        plain="Three steps to"
        em="your seat."
      />
      <div className="v2-howitworks-grid">
        {steps.map((s) => (
          <div key={s.n} className="v2-howitworks-card">
            <div className="v2-howitworks-num">{s.n}</div>
            <h3 className="v2-howitworks-title">{s.title}</h3>
            <p className="v2-howitworks-body">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// On-page curriculum section — what the "Explore the curriculum" hero button scrolls to.
// Reads instructor + about + curriculum modules from site.config.js so this is fully editable.
function V2Curriculum({ nextMc, onReserve, reserved, onManage }) {
  if (!nextMc) return null;
  const merged = mergeMcWithConfig(nextMc);
  if (!merged) return null;
  const instructor = merged.instructor || V2_INSTRUCTOR;
  const instName = typeof instructor.name === 'string' ? instructor.name : 'Balaji Chippada';
  const initials = instName.split(' ').map((s) => s[0]).slice(0, 2).join('');
  const modules = Array.isArray(merged.curriculum) ? merged.curriculum : [];
  const free = isMcFree(merged);

  return (
    <section className="v2-curriculum" id="v2-curriculum">
      <V2SectionHeader
        eyebrow="Curriculum"
        plain="What we'll build"
        em="together, live."
      />

      <div className="v2-curriculum-meta">
        <span className="v2-curriculum-chip">📅 {formatMcFullDateTime(merged.dateTime)}</span>
        <span className="v2-curriculum-chip">⏱ {merged.duration || 180} min</span>
        <span className="v2-curriculum-chip v2-curriculum-chip--accent">{free ? <>🎟️ <V2McPrice mc={merged} /></> : formatMcPriceShort(merged)}</span>
        {Array.isArray(merged.stack) && merged.stack.length > 0 && (
          <span className="v2-curriculum-stack">{merged.stack.join(' · ')}</span>
        )}
      </div>

      {/* Instructor strip */}
      <div className="v2-curriculum-instructor">
        {instructor.photo ? (
          <img className="v2-curriculum-photo" src={instructor.photo} alt={instructor.name} loading="lazy" decoding="async" />
        ) : (
          <div className="v2-curriculum-photo v2-curriculum-photo--initials">{initials}</div>
        )}
        <div className="v2-curriculum-itext">
          <div className="v2-curriculum-iname">{instructor.name}</div>
          <div className="v2-curriculum-ititle">{instructor.title}</div>
          {instructor.bio && <p className="v2-curriculum-ibio">{instructor.bio}</p>}
        </div>
      </div>

      {/* About */}
      {merged.about && (
        <div className="v2-curriculum-about">
          <h3>About this masterclass</h3>
          <p>{merged.about}</p>
          {merged.whyJoin && <p><strong>Why join:</strong> {merged.whyJoin}</p>}
          {merged.idealFor && <p><strong>Ideal for:</strong> {merged.idealFor}</p>}
        </div>
      )}

      {/* Modules */}
      {modules.length > 0 && (
        <div className="v2-curriculum-modules">
          {modules.map((m, i) => (
            <div key={i} className="v2-curriculum-module">
              <div className="v2-curriculum-module-head">
                <span className="v2-curriculum-module-num">{m.module || `Module ${String(i + 1).padStart(2, '0')}`}</span>
                {m.duration && <span className="v2-curriculum-module-time">{m.duration}</span>}
              </div>
              <h4 className="v2-curriculum-module-title">{m.title}</h4>
              {Array.isArray(m.points) && (
                <ul>
                  {m.points.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="v2-curriculum-footer">
        {reserved ? (
          <button type="button" className="v2-curriculum-cta" onClick={() => onManage && onManage()}>
            You&apos;re registered ✓ · View my account →
          </button>
        ) : (
          <button type="button" className="v2-curriculum-cta" onClick={() => onReserve(nextMc)}>
            {free ? <>Reserve seat · <V2McPrice mc={merged} /></> : `Book my seat · ${formatMcPriceShort(merged)}`} →
          </button>
        )}
      </div>
    </section>
  );
}

// Wide "Not sure where to start?" CTA card — routes the unsure visitor to the roadmap.
function V2WhereToStart({ onRoadmap }) {
  return (
    <section className="v2-wts" aria-label="Not sure where to start">
      <div className="v2-wts-card">
        <div className="v2-wts-text">
          <h3>Not sure where to start with <span className="v2-wts-accent">Agentic AI</span>?</h3>
          <p>Follow a step-by-step roadmap — know exactly what to learn, in what order, and which projects to build first.</p>
        </div>
        <button type="button" className="v2-wts-cta" onClick={onRoadmap}>
          View roadmap →
        </button>
      </div>
    </section>
  );
}

function V2FollowGrid() {
  const cards = [
    {
      key: 'youtube',
      label: 'YouTube',
      sub: `${V2_SOCIAL.youtubeSubs} subscribers`,
      cta: 'Subscribe',
      href: V2_BRAND.youtubeChannel,
      brandClass: 'is-youtube',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      sub: 'Connect & follow',
      cta: 'Follow',
      href: V2_BRAND.linkedin,
      brandClass: 'is-linkedin',
    },
    {
      key: 'github',
      label: 'GitHub',
      sub: 'Open-source roadmap',
      cta: 'Star repo',
      href: V2_ROADMAP_URL,
      brandClass: 'is-github',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      sub: 'Behind the scenes',
      cta: 'Follow',
      href: V2_BRAND.instagram,
      brandClass: 'is-instagram',
    },
  ];
  return (
    <section className="v2-follow" aria-label="Follow Balaji">
      <div className="v2-follow-eyebrow">Follow Balaji · same content, every platform</div>
      <div className="v2-follow-grid">
        {cards.map((c) => (
          <a
            key={c.key}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`v2-follow-card ${c.brandClass}`}
          >
            <span className="v2-follow-icon"><V2SocialIcon name={c.key} /></span>
            <span className="v2-follow-name">{c.label}</span>
            <span className="v2-follow-sub">{c.sub}</span>
            <span className="v2-follow-cta">{c.cta} →</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Reusable centered section header — eyebrow + serif-italic emphasized title.
function V2SectionHeader({ eyebrow, plain, em }) {
  return (
    <header className="v2-section-header">
      {eyebrow && <span className="v2-section-eyebrow">{eyebrow}</span>}
      <h2 className="v2-section-title">
        {plain}
        {em && <em className="v2-section-title-em"> {em}</em>}
      </h2>
    </header>
  );
}

function V2SuccessStories() {
  const stories = [
    {
      quote: 'Shipped my first agentic feature in 3 days. Demo-first teaching just works.',
      name: 'Rahul Mehta',
      role: 'SDE · Bengaluru',
      tag: 'After Claude Code session',
    },
    {
      quote: 'Finally got LLM vs workflow vs agent. Balaji runs the agent first, then explains.',
      name: 'Sneha Iyer',
      role: 'ML Engineer',
      tag: 'After roadmap',
    },
    {
      quote: 'Free roadmap got me started. The masterclass got me shipping in production.',
      name: 'Vikram K.',
      role: 'Fresher · Hyderabad',
      tag: 'After RAG session',
    },
  ];
  return (
    <section className="v2-stories" aria-label="Student success stories">
      <V2SectionHeader
        eyebrow="From the cohort"
        plain="Engineers shipping,"
        em="not just learning."
      />
      <div className="v2-stories-grid">
        {stories.map((s, i) => (
          <article key={i} className="v2-story-card">
            <div className="v2-story-stars" aria-hidden="true">★★★★★</div>
            <p className="v2-story-quote">&ldquo;{s.quote}&rdquo;</p>
            <div className="v2-story-meta">
              <div className="v2-story-name">{s.name}</div>
              <div className="v2-story-role">{s.role}</div>
            </div>
            <span className="v2-story-tag">{s.tag}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function V2ClosingCTA({ nextMc, onReserve, reserved, onManage }) {
  if (!nextMc) return null;
  const free = isMcFree(nextMc);
  return (
    <section className="closing-cta">
      <RevealOnScroll>
        <span className="closing-cta__eyebrow">Next session · {formatMcFullDateTime(nextMc.dateTime)}</span>
        <h2 className="closing-cta__headline">
          {reserved ? 'You’re in. See you live.' : 'Stop watching tutorials. Ship one with me.'}
        </h2>
        <p className="closing-cta__sub">
          2 hours live · {free ? 'free first masterclass' : 'single price'} · recording &amp; slides included
          {free ? ' · WhatsApp community access' : ' · 100% refund within 24h'}.
        </p>
        <button
          className="hero__primary-cta v2-closing-btn"
          onClick={() => reserved ? (onManage && onManage()) : onReserve(nextMc)}
        >
          {reserved
            ? 'You’re registered ✓ · View my account →'
            : (free ? <>Reserve seat · <V2McPrice mc={nextMc} /> →</> : `Book my seat · ${formatMcPriceShort(nextMc)} →`)}
        </button>
        <div className="closing-cta__microcopy">
          {reserved
            ? 'Meeting link will be emailed before the masterclass · Session details in My Account'
            : 'Meeting link emailed a few days before the masterclass +  Meeting reminders'}
        </div>
      </RevealOnScroll>
    </section>
  );
}

function V2MobileStickyBar({ nextMc, onReserve, reserved, onManage }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!nextMc) return null;
  const free = isMcFree(nextMc);
  // Already reserved → stop nudging; show a quiet "registered" confirmation.
  if (reserved) {
    return (
      <div className={`v2-mobile-sticky v2-mobile-sticky--reserved ${visible ? 'is-visible' : ''}`}>
        <div className="v2-mobile-sticky-meta">
          <span className="v2-mobile-sticky-date">✓ You&apos;re registered</span>
          <span className="v2-mobile-sticky-seats">{formatMcShortDate(nextMc.dateTime)}</span>
        </div>
        <button type="button" className="hero__primary-cta v2-mobile-sticky-btn" onClick={() => onManage && onManage()}>
          View
        </button>
      </div>
    );
  }
  return (
    <div className={`v2-mobile-sticky ${visible ? 'is-visible' : ''}`}>
      <div className="v2-mobile-sticky-meta">
        <span className="v2-mobile-sticky-date">{formatMcShortDate(nextMc.dateTime)}</span>
      </div>
      <button type="button" className="hero__primary-cta v2-mobile-sticky-btn" onClick={() => onReserve(nextMc)}>
        {free ? <>Reserve · <V2McPrice mc={nextMc} /></> : `Book · ${formatMcPriceShort(nextMc)}`}
      </button>
    </div>
  );
}

function V2WhatsAppButton() {
  // On mobile the FAB sits over the hero and clipped the hero microcopy at
  // certain scroll positions. Fade it in only after scrolling past the hero
  // (CSS applies the hide on small screens only — desktop is unaffected).
  const [atTop, setAtTop] = useState(typeof window !== 'undefined' ? window.scrollY < 560 : true);
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 560);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <a
      className={`v2-whatsapp-float${atTop ? ' v2-whatsapp-float--attop' : ''}`}
      href={V2_BRAND.whatsappCommunity}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join WhatsApp community"
      title="Join WhatsApp community"
    >
      <span className="v2-whatsapp-float__icon-wrap" aria-hidden="true">
        <svg className="v2-whatsapp-float__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </span>
      <span className="v2-whatsapp-float__label">Join</span>
    </a>
  );
}

function V2LegalModal({ page, onClose }) {
  if (!page) return null;
  const content = {
    refund: { title: 'Refund Policy', body: '100% refund within 24 hours of purchase, no questions asked. Email team@balajichippada.com with your order ID.' },
    privacy: { title: 'Privacy Policy', body: 'We collect name, email, and phone to deliver masterclass access and updates. We do not sell your data. Contact us to delete your account.' },
    terms: { title: 'Terms of Service', body: 'Masterclass content is for personal learning. Recording redistribution is prohibited. Sessions may be rescheduled with 48h notice.' },
    contact: {
      title: 'Contact',
      body: (
        <>
          <p className="modal-desc">
            Email: <a href="mailto:team@balajichippada.com">team@balajichippada.com</a>
            {' · '}We respond within 24 hours.
          </p>
          <a
            href={V2_BRAND.whatsappCommunity}
            target="_blank"
            rel="noopener noreferrer"
            className="form-btn v2-btn-secondary v2-contact-whatsapp"
          >
            <svg className="v2-contact-whatsapp-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Join the WhatsApp community
          </a>
        </>
      ),
    },
  }[page] || { title: page, body: <p className="modal-desc"></p> };

  // `body` may be a plain string (legal pages) or a JSX node (contact).
  const bodyNode = typeof content.body === 'string'
    ? <p className="modal-desc">{content.body}</p>
    : content.body;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={content.title}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">{content.title}</h2>
        {bodyNode}
      </div>
    </div>
  );
}
