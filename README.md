# MIME Header Word Decoder

Parses RFC 2047 `encoded-word` headers (`=?charset?encoding?text?=`) and returns a decoded `string`, with surrounding whitespace folded so adjacent encoded words concatenate cleanly.

## Usage

```js
import { decodeHeader } from "./src/core.js";

decodeHeader("=?UTF-8?B?SGVsbG8sIHdvcmxkIQ==?=");
// → "Hello, world!"

decodeHeader("=?UTF-8?Q?Ol=C3=A9?= monde");
// → "Olé monde"
```

## Why

Email subjects and display names routinely contain non-ASCII text wrapped in RFC 2047 encoded-words. Writing the decoder by hand each time is error-prone. This library exists to do exactly that job — and no more.

**Scope chosen.** Only `B` (Base64) and `Q` (Quoted-Printable) encodings are supported, and only `UTF-8` and `US-ASCII` are accepted as charsets (other charsets throw). This is a deliberate, stated limitation: a correct decoder for arbitrary historical charsets would require a full text-encoding table, which violates the zero-dependency brief. Anything outside these two charsets will throw rather than produce a possibly-wrong result.

## Awkward edge

RFC 2047 mandates that whitespace between two adjacent encoded-words is removed during folding — `=?B?...?= =?B?...?=` becomes the concatenation with no space between. This decoder honors that rule: whitespace that is purely structural folding between adjacent encoded words is dropped, while literal whitespace inside surrounding plain text is preserved.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

