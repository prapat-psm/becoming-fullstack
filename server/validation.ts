import { BadRequestException } from '@nestjs/common';

export function positiveInt(value: unknown, field: string, max = 2_147_483_647) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > max) {
    throw new BadRequestException(`${field} must be a whole number from 1 to ${max}.`);
  }
  return number;
}

export function requiredText(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || value.includes('\0')) {
    throw new BadRequestException(`${field} must be between 1 and ${max} characters.`);
  }
  return value.trim();
}

function utcDate(value: unknown, field: string) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime()) && date.toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z')) {
      return date;
    }
  }
  throw new BadRequestException(`${field} must be an ISO 8601 timestamp in UTC.`);
}

export function timeWindow(start: unknown, end: unknown) {
  const startsAt = utcDate(start, 'startsAt');
  const endsAt = utcDate(end, 'endsAt');
  if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Start time must be in the future.');
  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration <= 0 || duration > 8 * 60 * 60 * 1000) {
    throw new BadRequestException('Choose an end time after the start, within eight hours.');
  }
  return { startsAt, endsAt };
}
