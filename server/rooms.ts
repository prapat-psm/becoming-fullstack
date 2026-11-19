import { Body, ConflictException, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Auth } from './auth.js';
import { Database } from './db.js';
import { positiveInt, requiredText, timeWindow } from './validation.js';

export function databaseCode(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

@Controller('rooms')
export class RoomsController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Auth) private readonly auth: Auth,
  ) {}

  @Get()
  async list(@Query('startsAt') start?: string, @Query('endsAt') end?: string) {
    if (start === undefined && end === undefined) {
      const { rows } = await this.db.pool.query('SELECT id, name, capacity, location FROM rooms ORDER BY name');
      return rows;
    }
    const { startsAt, endsAt } = timeWindow(start, end);
    const { rows } = await this.db.pool.query(`SELECT r.id, r.name, r.capacity, r.location,
      NOT EXISTS (
        SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.cancelled_at IS NULL
        AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange($1, $2, '[)')
      ) AS available FROM rooms r ORDER BY name`, [startsAt, endsAt]);
    return rows;
  }

  @Post()
  async create(@Req() req: Request, @Body() body?: Record<string, unknown>) {
    await this.auth.require(req, 'admin');
    return this.save(body);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body?: Record<string, unknown>) {
    await this.auth.require(req, 'admin');
    return this.save(body, positiveInt(id, 'Room ID'));
  }

  private async save(body: Record<string, unknown> | undefined, id?: number) {
    const name = requiredText(body?.name, 'Name', 80);
    const capacity = positiveInt(body?.capacity, 'Capacity', 100);
    const location = requiredText(body?.location, 'Location', 80);
    try {
      const result = id === undefined
        ? await this.db.pool.query('INSERT INTO rooms (name, capacity, location) VALUES ($1, $2, $3) RETURNING *', [name, capacity, location])
        : await this.db.pool.query('UPDATE rooms SET name = $1, capacity = $2, location = $3 WHERE id = $4 RETURNING *', [name, capacity, location, id]);
      if (!result.rows[0]) throw new NotFoundException('Room not found.');
      return result.rows[0];
    } catch (error) {
      if (databaseCode(error) === '23505') throw new ConflictException('A room already uses this name.');
      throw error;
    }
  }
}

@Controller('bookings')
export class BookingsController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Auth) private readonly auth: Auth,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const user = await this.auth.require(req);
    const { rows } = await this.db.pool.query(`SELECT b.id, r.name AS "roomName", r.location,
      b.starts_at AS "startsAt", b.ends_at AS "endsAt", b.cancelled_at AS "cancelledAt"
      FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.user_id = $1
      ORDER BY b.starts_at DESC, b.id DESC`, [user.id]);
    return rows;
  }

  @Post()
  async create(@Req() req: Request, @Body() body?: Record<string, unknown>) {
    const user = await this.auth.require(req);
    const room = positiveInt(body?.roomId, 'Room ID');
    const { startsAt, endsAt } = timeWindow(body?.startsAt, body?.endsAt);
    try {
      const { rows } = await this.db.pool.query(`INSERT INTO bookings (room_id, user_id, starts_at, ends_at)
        VALUES ($1, $2, $3, $4) RETURNING id`, [room, user.id, startsAt, endsAt]);
      return rows[0];
    } catch (error) {
      const code = databaseCode(error);
      if (code === '23P01') throw new ConflictException('This room was already booked for part of that time.');
      if (code === '23503' && (error as { constraint?: string }).constraint === 'bookings_room_id_fkey') {
        throw new NotFoundException('Room not found.');
      }
      throw error;
    }
  }

  @Delete(':id')
  async cancel(@Req() req: Request, @Param('id') id: string) {
    const user = await this.auth.require(req);
    const { rowCount } = await this.db.pool.query(`UPDATE bookings SET cancelled_at = COALESCE(cancelled_at, now())
      WHERE id = $1 AND user_id = $2 AND (cancelled_at IS NOT NULL OR starts_at > now())`,
    [positiveInt(id, 'Booking ID'), user.id]);
    if (!rowCount) throw new NotFoundException('Upcoming booking not found.');
    return { cancelled: true };
  }
}
