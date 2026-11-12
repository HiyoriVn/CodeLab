import test from 'node:test';
import assert from 'node:assert/strict';
import { assertGoldenEqual } from './helpers/golden.mjs';

test('golden comparisons accept LF, CRLF and mixed checkout newlines in either operand', () => {
  const source = 'void setup() {\n  digitalWrite(47, LOW);\n}\n';
  const crlf = source.replaceAll('\n', '\r\n');
  assertGoldenEqual(source, crlf);
  assertGoldenEqual(crlf, source);
  assertGoldenEqual(source.replace('\n', '\r\n'), source);
});

test('golden comparisons still reject changed C++, spacing and missing final newlines', () => {
  const source = 'void setup() {\n  digitalWrite(47, LOW);\n}\n';
  for (const changed of [source.replace('LOW','HIGH'), source.replace('  digital',' digital'), source.slice(0,-1)]) {
    assert.throws(() => assertGoldenEqual(source, changed), assert.AssertionError);
  }
});

test('golden comparisons preserve escaped characters and standalone carriage returns', () => {
  assert.throws(() => assertGoldenEqual('Serial.print("\\r\\n");\n', 'Serial.print("\\n");\n'), assert.AssertionError);
  assert.throws(() => assertGoldenEqual('a\rb\n', 'a\nb\n'), assert.AssertionError);
});
