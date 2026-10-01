// Turns raw statement descriptions ("SQ *BLUE BOTTLE COF 0423 OAKLAND CA") into a
// readable merchant name ("Blue Bottle Cof") so purchases can be grouped by place.

const ALIASES = [
  [/\b(AMZN|AMAZON)\b/i, 'Amazon'],
  [/\bUBER\s*\*?\s*EATS\b/i, 'Uber Eats'],
  [/\bUBER\b/i, 'Uber'],
  [/\bLYFT\b/i, 'Lyft'],
  [/\bDOORDASH\b|^DD\s*\*/i, 'DoorDash'],
  [/\bGRUBHUB\b/i, 'Grubhub'],
  [/\bINSTACART\b/i, 'Instacart'],
  [/\bNETFLIX\b/i, 'Netflix'],
  [/\bSPOTIFY\b/i, 'Spotify'],
  [/\bHULU\b/i, 'Hulu'],
  [/APPLE\.COM|\bAPPLE STORE\b|\bITUNES\b/i, 'Apple'],
  [/\bWAL-?MART\b|\bWM SUPERCENTER\b/i, 'Walmart'],
  [/\bTARGET\b/i, 'Target'],
  [/\bCOSTCO\b/i, 'Costco'],
  [/\bSTARBUCKS\b/i, 'Starbucks'],
  [/\bWHOLEFDS\b|\bWHOLE FOODS\b/i, 'Whole Foods'],
  [/\bTRADER JOE/i, "Trader Joe's"],
  [/\bCVS\b/i, 'CVS'],
  [/^AMC\b/i, 'AMC Theatres'],
  [/\bWALGREENS\b/i, 'Walgreens'],
  [/\bMCDONALD/i, "McDonald's"],
  [/\bCHICK-FIL-A\b/i, 'Chick-fil-A'],
  [/\bVENMO\b/i, 'Venmo'],
  [/\bPAYPAL\b(?!\s*\*)/i, 'PayPal'],
];

// "SQ *", "TST* ", "PAYPAL *" ... processor prefixes that hide the real merchant
const STAR_PREFIX = /^(SQ|TST|PP|SP|PY|IN|BT|CKE|DD|PAYPAL|GOOGLE|LEVEL ?UP|TOAST|SQU)\s*\*\s*/i;
const WORD_PREFIX = /^(APLPAY|APL\s?PAY|POS|DEBIT CARD PURCHASE|PURCHASE AUTHORIZED ON \S+|CHECKCARD \S+|RECURRING PAYMENT|POS PURCHASE|ACH)\s+/i;

const STATES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));

const titleCase = (word) => {
  if (/\.(com|net|org|io)$/i.test(word)) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return word
    .toLowerCase()
    .replace(/(^|[-'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(/'S\b/, "'s");
};

export function merchantName(description) {
  let text = String(description || '').trim();
  if (!text) return 'Unknown';

  for (const [pattern, name] of ALIASES) {
    if (pattern.test(text)) return name;
  }

  text = text.replace(STAR_PREFIX, '').replace(WORD_PREFIX, '');

  let words = text
    .replace(/[_*#/\\|]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w&']+|[^\w&'.]+$/g, ''))
    .filter((w) => w && !/\d/.test(w));

  // trailing "AUSTIN TX" style locations add noise to the grouping key
  if (words.length > 1 && STATES.has(words[words.length - 1].toUpperCase())) words.pop();

  words = words.slice(0, 3);
  if (!words.length) return titleCase(text.split(/\s+/)[0] || 'Unknown');
  return words.map(titleCase).join(' ');
}
