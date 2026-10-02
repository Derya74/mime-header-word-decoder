// Pure-JS RFC 2047 encoded-word decoder.
// Spec: https://www.rfc-editor.org/rfc/rfc2047
// Only Base64 and Quoted-Printable encodings are supported, and only
// UTF-8 and US-ASCII as charsets. Supporting arbitrary legacy charsets
// would require a text-encoding table — incompatible with the
// zero-dependency constraint of this library.

const RE_ENCODED_WORD = /=\?([A-Za-z0-9-]+)\?([BbQq])\?([^?]*)\?=/g;

// atob is available in Node 16+ and all modern browsers, but we guard
// for environments where it may not exist so the failure mode is a
// clear throw rather than a ReferenceError.
function decodeBase64ToBytes(str) {
  if (typeof atob !== "function") {
    throw new Error("atob is not available in this environment");
  }
  const bin = atob(str);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

function decodeQToBytes(str) {
  // RFC 2047 §4.2: in Q-encoding, underscore is a shorthand for U+0020
  // SPACE. This differs from ordinary Quoted-Printable (RFC 2045),
  // where underscore is a literal underscore — hence the substitution
  // before hex decoding.
  const s = str.replace(/_/g, " ");
  const bytes = [];
  let i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 0x3d /* = */ && i + 2 < s.length) {
      const h1 = s.charCodeAt(i + 1);
      const h2 = s.charCodeAt(i + 2);
      const v = hexPairToByte(h1, h2);
      if (v === -1) {
        // Malformed escape — fall back to a literal '='. RFC 2047 is
        // permissive about real-world input; a hard throw here would
        // reject more mail than it would protect.
        bytes.push(c);
        i += 1;
      } else {
        bytes.push(v);
        i += 3;
      }
    } else {
      bytes.push(c);
      i += 1;
    }
  }
  return Uint8Array.from(bytes);
}

function hexPairToByte(h1, h2) {
  const hi = hexDigit(h1);
  const lo = hexDigit(h2);
  if (hi === -1 || lo === -1) return -1;
  return (hi << 4) | lo;
}

function hexDigit(c) {
  if (c >= 0x30 && c <= 0x39) return c - 0x30; // 0-9
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10; // A-F
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10; // a-f
  return -1;
}

function bytesToString(bytes, charset) {
  const norm = charset.toLowerCase();
  if (norm === "utf-8" || norm === "utf8" || norm === "us-ascii" || norm === "ascii") {
    // TextDecoder with utf-8 handles ASCII as a strict subset and is
    // available in all modern runtimes (Node, browsers, Deno). It is
    // the standard-library way to turn bytes into a JS string.
    return new TextDecoder("utf-8").decode(bytes);
  }
  throw new Error(`Unsupported charset: ${charset}`);
}

function parseEncodedWord(charset, encoding, encodedText) {
  const bytes = encoding === "b" || encoding === "B"
    ? decodeBase64ToBytes(encodedText)
    : decodeQToBytes(encodedText);
  return bytesToString(bytes, charset);
}

/**
 * Decode an RFC 2047 encoded-word header value into a plain string.
 *
 * Supports `B` (Base64) and `Q` (Quoted-Printable) encodings, and
 * `UTF-8` / `US-ASCII` charsets only. Adjacent encoded-words separated
 * only by whitespace have that whitespace removed (RFC 2047 folding).
 *
 * @param {string} header - Raw header value possibly containing encoded-words.
 * @returns {string} Decoded text.
 * @throws {Error} If a referenced charset is not UTF-8 or US-ASCII.
 */
export function decodeHeader(header) {
  if (typeof header !== "string") {
    throw new TypeError("header must be a string");
  }
  if (header.indexOf("=?") === -1) {
    return header;
  }

  RE_ENCODED_WORD.lastIndex = 0;
  let result = "";
  let lastEnd = 0;
  let lastWasEncoded = false;
  let match;

  while ((match = RE_ENCODED_WORD.exec(header)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const between = header.slice(lastEnd, start);

    if (lastWasEncoded && /^[ \t\r\n]*$/.test(between)) {
      // RFC 2047 §6.2: whitespace that is purely structural folding
      // between two adjacent encoded-words is removed during decoding.
    } else {
      result += between;
    }

    result += parseEncodedWord(match[1], match[2], match[3]);

    lastEnd = end;
    lastWasEncoded = true;
  }

  result += header.slice(lastEnd);
  return result;
}
