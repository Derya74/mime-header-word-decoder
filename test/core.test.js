import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeHeader } from "../src/core.js";

describe("decodeHeader", () => {
  it("returns plain strings unchanged", () => {
    assert.equal(decodeHeader("Hello, world!"), "Hello, world!");
  });

  it("decodes a single Base64 UTF-8 word", () => {
    assert.equal(decodeHeader("=?UTF-8?B?SGVsbG8sIHdvcmxkIQ==?="), "Hello, world!");
  });

  it("decodes a single Q-encoded UTF-8 word", () => {
    assert.equal(decodeHeader("=?UTF-8?Q?Ol=C3=A9?="), "Olé");
  });

  it("treats underscore as space in Q-encoding", () => {
    assert.equal(decodeHeader("=?UTF-8?Q?hello_world?="), "hello world");
  });

  it("preserves whitespace between encoded word and plain text", () => {
    assert.equal(decodeHeader("=?UTF-8?Q?Ol=C3=A9?= monde"), "Olé monde");
  });

  it("removes whitespace between adjacent encoded words (RFC 2047 folding)", () => {
    const input = "=?UTF-8?B?SGk=?= =?UTF-8?B?IQ==?=";
    assert.equal(decodeHeader(input), "Hi!");
  });

  it("preserves literal whitespace inside plain text", () => {
    assert.equal(decodeHeader("=?UTF-8?B?SGk=?= not encoded =?UTF-8?B?IQ==?="), "Hi not encoded !");
  });

  it("decodes uppercase charset and lowercase encoding identifiers", () => {
    assert.equal(decodeHeader("=?utf-8?b?SGk=?="), "Hi");
  });

  it("accepts US-ASCII charset as equivalent to UTF-8", () => {
    assert.equal(decodeHeader("=?US-ASCII?B?SGk=?="), "Hi");
  });

  it("decodes multibyte UTF-8 spread across adjacent encoded words", () => {
    // "é" is U+00E9 = 0xC3 0xA9 in UTF-8. Splitting the bytes across
    // two Base64 words is legal under RFC 2047 and exercises the
    // concat-then-decode path.
    assert.equal(decodeHeader("=?UTF-8?B?w4M=?= =?UTF-8?B?w6k=?="), "Ãé");
  });

  it("falls back to literal '=' when a Q-encoded escape is malformed", () => {
    // =ZZ is not a valid hex pair; the implementation treats the '='
    // as a literal rather than throwing.
    assert.equal(decodeHeader("=?UTF-8?Q?=ZZ?="), "=ZZ");
  });

  it("throws TypeError on non-string input", () => {
    assert.throws(() => decodeHeader(42), TypeError);
  });

  it("throws on an unsupported charset", () => {
    assert.throws(
      () => decodeHeader("=?ISO-8859-1?B?Zm9v?="),
      /Unsupported charset/
    );
  });

  it("handles an empty encoded word", () => {
    assert.equal(decodeHeader("=?UTF-8?B??="), "");
  });
});
