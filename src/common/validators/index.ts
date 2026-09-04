/**
 * iCertiX - Request Validation Helpers
 */

import { ValidationError } from '../errors/AppError';

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function assertRequired(obj: Record<string, any>, fields: string[]) {
  const missing: string[] = [];
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new ValidationError(`Missing required field(s): ${missing.join(', ')}`, { missingFields: missing });
  }
}

export function assertEmail(email: string) {
  if (!validateEmail(email)) {
    throw new ValidationError(`Invalid email format: '${email}'`);
  }
}
