// Phone-number *format* check shared by the consultation and contact forms.
// It only checks that the input looks like a phone number — it never rewrites
// the number and can't tell whether it is real or reachable.
//
// Accepted (after trimming surrounding whitespace):
//   - digits, separated by single spaces or hyphens: 98765 43210, 044-2345-6789
//   - an optional leading "+" followed by a non-zero digit: +91 98765 43210
//   - at most one pair of parentheses around 1–5 digits: (044) 2345 6789,
//     +1 (202) 555-0123, +44 (0)20 7946 0958
//   - 8–15 digits in total. 15 is the international (E.164) maximum including
//     the country code; 8 excludes short local numbers that can't be called
//     back without an area code.
//   - when the Indian country code is given (+91 or 0091): exactly 10 digits
//     after it (every Indian mobile and STD landline number has 10), ignoring
//     one optional trunk 0 — e.g. +91 98765 43210, +91 (0)44 2345 6789.
//     Numbers without a country code can't be told apart from other
//     countries' numbers, so they only get the general 8–15 check.
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;
const INDIA_NATIONAL_DIGITS = 10;

// A digit group, optionally starting with one parenthesised group: 98765, (044), (0)20.
const GROUP = /^(?:\(\d{1,5}\))?\d*$/;

// Returns '' for a valid number, otherwise a message describing the problem.
// Callers handle the empty/required case themselves.
export function getPhoneFormatError(raw) {
  const value = raw.trim();

  if (!/^[\d\s()+-]+$/.test(value)) {
    return 'Phone number can contain only digits, spaces, hyphens, parentheses and a leading +';
  }

  // "+" only as the first character, followed by a non-zero digit (country codes never start with 0).
  let body = value;
  if (body.startsWith('+')) {
    if (!/^\+[1-9]/.test(body)) return 'A leading + must be followed by the country code, e.g. +91';
    body = body.slice(1);
  }
  if (body.includes('+')) return 'Use + only once, at the start of the number';

  // Single spaces or hyphens between groups — an empty part means a doubled,
  // leading or trailing separator.
  const parts = body.split(/[\s-]/);
  if (parts.some((part) => part === '')) return 'Check the spacing — use single spaces or hyphens between digits';

  const parenParts = parts.filter((part) => part.includes('(') || part.includes(')'));
  if (parenParts.length > 1 || !parts.every((part) => part !== '' && GROUP.test(part) && /\d/.test(part))) {
    return 'Check the brackets — use one pair around the area code, e.g. (044) 2345 6789';
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return `Phone number must have ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits`;
  }

  // Indian country code given → exactly 10 national digits (one trunk 0 allowed).
  // Country codes are prefix-free, so anything starting +91 is India; 0091 is
  // the same with the international dialling prefix. Value = digits to skip.
  const indianPrefix = value.startsWith('+91') ? 2 : value.startsWith('0091') ? 4 : 0;
  if (indianPrefix) {
    const national = digits.slice(indianPrefix).replace(/^0/, '');
    if (national.length !== INDIA_NATIONAL_DIGITS) {
      return `Indian numbers need ${INDIA_NATIONAL_DIGITS} digits after the +91 country code`;
    }
  }

  return '';
}
