import assert from 'node:assert/strict';
import {formatKyrgyzPhoneInput as format, normalizePhone, isValidKyrgyzPhone, nationalPhoneToAccount} from '../../src/lib/formatters';

// Reproduce controlled TextInput keystrokes, not only whole-string paste.
for (const input of ['+996700123456', '996700123456', '0700123456', '700123456']) {
  let value = '';
  for (const char of input) value = format(value + char);
  assert.equal(normalizePhone(value), '+996700123456', input);
  assert.ok(isValidKyrgyzPhone(value));
  assert.equal(normalizePhone(format(input)), '+996700123456');
}
assert.equal(format(''), '');
assert.equal(format('+'), '+');
assert.equal(format('+9'), '+9');
assert.equal(format('+99'), '+99');
assert.equal(format('+996'), '+996');
assert.equal(format('+996 700 123 456'), '+996 700 123 456');
assert.equal(isValidKyrgyzPhone(format('+9967001234569')), false, 'Do not silently truncate an incorrect phone');
assert.equal(isValidKyrgyzPhone(format('+77001234567')), false, 'Do not replace a different country with +996');
let value = format('+996700123456');
while (value) {
  const next = format(value.slice(0,-1));
  assert.ok(next.length < value.length, 'Backspace can clear the field');
  value = next;
}
console.log('PASS phone input: four typed/pasted formats, partial country prefix, deletion, excess digits and foreign country');

// Fixed +996 prefix: local typing, national/full-number paste, clearing and
// foreign/excess digits must preserve the actual account number.
for (const input of ['700123456', '0700123456', '+996700123456', '996700123456']) {
  assert.equal(nationalPhoneToAccount(input), '+996700123456');
}
let national = '';
for (const char of '700123456') {
  const phone = nationalPhoneToAccount(national + char);
  national = format(phone).slice(4).trimStart();
}
assert.equal(normalizePhone(nationalPhoneToAccount(national)), '+996700123456');
while (national) {
  const next = nationalPhoneToAccount(national.slice(0, -1));
  const display = next ? format(next).slice(4).trimStart() : '';
  assert.ok(display.length < national.length);
  national = display;
}
assert.equal(nationalPhoneToAccount(''), '');
assert.equal(isValidKyrgyzPhone(nationalPhoneToAccount('+77001234567')), false);
assert.equal(isValidKyrgyzPhone(nationalPhoneToAccount('7001234569')), false);
console.log('PASS fixed +996 prefix: typed/pasted number, complete deletion, foreign code and excess digit rejection');
