import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { normalizePhone, UA_PHONE_PATTERN, UA_PHONE_MESSAGE } from './phone';

@ValidatorConstraint({ name: 'IsValidPhone', async: false })
export class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments) {
    if (typeof value !== 'string') {
      return false;
    }
    // Reject if the original value contains letters
    if (/[a-zA-Z]/.test(value)) {
      return false;
    }
    // Normalize and check against the Ukrainian phone pattern
    const normalized = normalizePhone(value);
    return typeof normalized === 'string' && UA_PHONE_PATTERN.test(normalized);
  }

  defaultMessage(_args: ValidationArguments) {
    return UA_PHONE_MESSAGE;
  }
}