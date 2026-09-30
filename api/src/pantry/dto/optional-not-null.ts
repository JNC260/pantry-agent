import { ValidateIf } from 'class-validator';

// Like @IsOptional(), but only skips validation when the field is absent.
// @IsOptional() also lets `null` through, which would write NULL into a
// NOT NULL column instead of returning a 400.
export function OptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined);
}
