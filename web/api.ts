export type User = { id: number; email: string; role: 'member' | 'admin' };
export type Room = { id: number; name: string; location: string; capacity: number; available?: boolean };
export type Booking = { id: number; roomName: string; location: string; startsAt: string; endsAt: string; cancelledAt: string | null };
export type TimeWindow = { startsAt: string; endsAt: string };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body && { 'Content-Type': 'application/json' }) },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok) throw new ApiError(response.status, payload.message ?? 'Something went wrong.');
  return payload;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Unable to reach Roombook. Try again in a moment.';
}
