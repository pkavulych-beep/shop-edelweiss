import { normalizePhone, UA_PHONE_PATTERN } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['380991234567', '380991234567'],
    ['+380991234567', '380991234567'],
    ['+38 (099) 123-45-67', '380991234567'],
    ['099 123 45 67', '380991234567'],
    ['0991234567', '380991234567'],
    ['991234567', '380991234567'],
    ['(099) 123-45-67', '380991234567'],
  ])('brings %s to 380991234567', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(UA_PHONE_PATTERN.test(expected as string)).toBe(true);
  });

  it.each([
    [''],
    [' '],
    ['12'],
    ['099123456'],
    ['3809912345678'],
    ['+48 501 234 567'],
  ])('leaves %s in a shape the pattern rejects', input => {
    expect(UA_PHONE_PATTERN.test(normalizePhone(input) as string)).toBe(false);
  });

  it('keeps values that are not strings untouched', () => {
    expect(normalizePhone(380991234567)).toBe(380991234567);
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone(null)).toBeNull();
  });
});
