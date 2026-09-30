/**
 * cp1252 (Windows-1252) character mapping, which Node's Buffer does not
 * provide. Needed to reverse mojibake: a UTF-8 byte sequence that was decoded as
 * cp1252 produces characters from the 0x80-0x9F range (€, ‚, ", …) which
 * plain latin1 cannot represent.
 */

/** Unicode value for each cp1252 byte 0x80-0x9F. Bytes 0xA0-0xFF are identity. */
const HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

/** Decode a string of mojibake characters back to the original bytes. */
export function toBytes(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f) {
      out.push(cp);
    } else if (cp >= 0xa0 && cp <= 0xff) {
      out.push(cp);
    } else if (cp >= 0x80 && cp <= 0x9f) {
      // Some decoders emit the C1 controls instead of the real characters.
      out.push(cp);
    } else {
      const idx = HIGH.indexOf(cp);
      if (idx === -1) return null; // not cp1252 text
      out.push(0x80 + idx);
    }
  }
  return Buffer.from(out);
}
