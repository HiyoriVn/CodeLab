import assert from 'node:assert/strict';

// Git may check out golden files as CRLF on Windows. Ignore only that
// representation difference; keep whitespace, literals and final newlines exact.
export function assertGoldenEqual(actual, expected, message = 'Golden source differs beyond CRLF/LF') {
  assert.equal(actual.replaceAll('\r\n', '\n'), expected.replaceAll('\r\n', '\n'), message);
}
