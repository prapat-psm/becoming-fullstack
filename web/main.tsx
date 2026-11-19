import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, errorMessage, type Booking, type Room, type TimeWindow, type User } from './api';
import './styles.css';

type Page = 'rooms' | 'bookings' | 'manage';
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ');
const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function localInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaults() {
  const nextHour = Math.floor(Date.now() / 3_600_000 + 1) * 3_600_000;
  return { start: localInput(new Date(nextHour)), end: localInput(new Date(nextHour + 3_600_000)) };
}

function Notice({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>{children}</p>;
}

function SignIn({ onSignIn }: { onSignIn: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      const result = await api<{ user: User }>('/session', { method: 'POST', body: JSON.stringify(data) });
      onSignIn(result.user);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setBusy(false); }
  }
  return <section className="panel login" aria-labelledby="sign-in-title">
    <h2 id="sign-in-title">Sign in to book</h2>
    <form onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {error && <Notice error>{error}</Notice>}
    </form>
  </section>;
}

function useData<T>(path: string, revision: number) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>();
  const key = `${revision}:${path}`;
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data }); },
      (error) => { if (!controller.signal.aborted) setResult({ key, error }); },
    );
    return () => controller.abort();
  }, [key, path]);
  return result?.key === key ? result : undefined;
}

function Rooms({ user, onSignIn }: { user: User | null; onSignIn: (user: User) => void }) {
  const [draft, setDraft] = useState(defaults);
  const [applied, setApplied] = useState<TimeWindow>();
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState<number>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const path = applied ? `/rooms?${new URLSearchParams(applied)}` : '/rooms';
  const result = useData<Room[]>(path, revision);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const start = new Date(draft.start);
    const end = new Date(draft.end);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || +start <= Date.now() || +end <= +start || +end - +start > 28_800_000) {
      setMessage({ error: true, text: 'Choose a future time window of up to eight hours.' });
      return;
    }
    setApplied({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    refresh((value) => value + 1);
  }

  async function book(room: Room) {
    if (!applied) return;
    setBusy(room.id);
    setMessage(undefined);
    try {
      await api('/bookings', { method: 'POST', body: JSON.stringify({ roomId: room.id, ...applied }) });
      setMessage({ text: `${room.name} is booked. You can find it under My bookings.` });
      refresh((value) => value + 1);
    } catch (error) {
      setMessage({ error: true, text: errorMessage(error) });
      if (error instanceof ApiError && error.status === 409) refresh((value) => value + 1);
    } finally { setBusy(undefined); }
  }

  return <>
    <header className="page-head"><h1>Find a room</h1><p>Check availability and book a room for your team.</p></header>
    <div className={user ? 'layout' : 'layout with-login'}>
      <div className="flow">
        <section className="panel" aria-labelledby="time-title">
          <div className="section-heading"><h2 id="time-title">When do you need it?</h2><span className="timezone">{timeZone}</span></div>
          <form className="availability" onSubmit={search}>
            <label>Starts<input type="datetime-local" required value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
            <label>Ends<input type="datetime-local" required value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
            <button className="primary" disabled={busy !== undefined}>Check availability</button>
          </form>
        </section>
        <section aria-labelledby="room-title">
          <div className="section-heading room-heading">
            <h2 id="room-title">Rooms</h2>
            {result?.data && <span className="muted">{applied ? `${result.data.filter((room) => room.available).length} available` : `${result.data.length} rooms`}</span>}
          </div>
          {applied && <p className="search-summary">Showing {formatDate.formatRange(new Date(applied.startsAt), new Date(applied.endsAt))}</p>}
          {message && <Notice error={message.error}>{message.text}</Notice>}
          {!result && <Notice>Loading rooms…</Notice>}
          {Boolean(result?.error) && <Notice error>{errorMessage(result?.error)}</Notice>}
          {result?.data?.length === 0 && <Notice>No rooms have been added yet.</Notice>}
          <ul className="room-list">
            {result?.data?.map((room) => <li className="room" key={room.id}>
              <span className="room-mark" aria-hidden="true">{room.name.slice(0, 1).toUpperCase()}</span>
              <div><h3>{room.name}</h3><p>{room.location} <span aria-hidden="true">·</span> {room.capacity} seats</p></div>
              <div className="room-actions">
                {applied && <span className={room.available ? 'pill available' : 'pill'}>{room.available ? 'Available' : 'Booked'}</span>}
                {applied && room.available && user && <button disabled={busy !== undefined} className="secondary" type="button" onClick={() => void book(room)} aria-label={`Book ${room.name}`}>
                  {busy === room.id ? 'Booking…' : 'Book room'}
                </button>}
              </div>
            </li>)}
          </ul>
        </section>
      </div>
      {!user && <SignIn onSignIn={onSignIn} />}
    </div>
  </>;
}

function MyBookings() {
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState<number>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const result = useData<Booking[]>('/bookings', revision);
  async function cancel(booking: Booking) {
    setBusy(booking.id);
    setMessage(undefined);
    try {
      await api(`/bookings/${booking.id}`, { method: 'DELETE' });
      setMessage({ text: `Your booking for ${booking.roomName} was cancelled.` });
      refresh((value) => value + 1);
    } catch (error) { setMessage({ error: true, text: errorMessage(error) }); }
    finally { setBusy(undefined); }
  }
  return <>
    <header className="page-head"><h1>My bookings</h1><p>View your reservations and cancel an upcoming booking.</p></header>
    {message && <Notice error={message.error}>{message.text}</Notice>}
    {!result && <Notice>Loading bookings…</Notice>}
    {Boolean(result?.error) && <Notice error>{errorMessage(result?.error)}</Notice>}
    {result?.data?.length === 0 && <Notice>Your bookings will appear here.</Notice>}
    <ul className="room-list">
      {result?.data?.map((booking) => {
        const upcoming = Date.parse(booking.startsAt) > Date.now();
        const status = booking.cancelledAt ? 'Cancelled' : upcoming ? 'Upcoming' : 'Started';
        return <li className="room" key={booking.id}>
          <div><h3>{booking.roomName}</h3><p>{booking.location}</p>
            <p>{formatDate.formatRange(new Date(booking.startsAt), new Date(booking.endsAt))}</p></div>
          <div className="room-actions"><span className="pill">{status}</span>
            {!booking.cancelledAt && upcoming && <button className="secondary" type="button" disabled={busy !== undefined} aria-label={`Cancel ${booking.roomName} booking`} onClick={() => void cancel(booking)}>{busy === booking.id ? 'Cancelling…' : 'Cancel'}</button>}
          </div>
        </li>;
      })}
    </ul>
  </>;
}

function ManageRooms() {
  const [revision, refresh] = useState(0);
  const [editing, setEditing] = useState<Room>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const result = useData<Room[]>('/rooms', revision);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage(undefined);
    try {
      const room = await api<Room>(editing ? `/rooms/${editing.id}` : '/rooms', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...data, capacity: Number(data.capacity) }),
      });
      setEditing(undefined);
      form.reset();
      refresh((value) => value + 1);
      setMessage({ text: `${room.name} was saved.` });
    } catch (error) { setMessage({ error: true, text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  return <>
    <header className="page-head"><h1>Manage rooms</h1><p>Add a room or update its name, capacity, and location.</p></header>
    <div className="layout with-login">
      <section aria-label="Existing rooms">
        {!result && <Notice>Loading rooms…</Notice>}
        {Boolean(result?.error) && <Notice error>{errorMessage(result?.error)}</Notice>}
        {result?.data?.length === 0 && <Notice>No rooms have been added yet.</Notice>}
        <ul className="room-list">{result?.data?.map((room) => <li className="room" key={room.id}>
          <div><h3>{room.name}</h3><p>{room.location} · {room.capacity} seats</p></div>
          <button className="secondary" type="button" disabled={busy} aria-label={`Edit ${room.name}`} onClick={() => { setEditing(room); setMessage(undefined); }}>Edit</button>
        </li>)}</ul>
      </section>
      <section className="panel login" aria-labelledby="room-form-title">
        <h2 id="room-form-title">{editing ? `Edit ${editing.name}` : 'Add a room'}</h2>
        <form key={editing?.id ?? 'new'} onSubmit={save}>
          <label>Name<input name="name" required maxLength={80} defaultValue={editing?.name} /></label>
          <label>Location<input name="location" required maxLength={80} defaultValue={editing?.location} /></label>
          <label>Capacity<input name="capacity" type="number" min={1} max={100} required defaultValue={editing?.capacity} /></label>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save room'}</button>
          {editing && <button className="secondary" type="button" disabled={busy} onClick={() => { setEditing(undefined); setMessage(undefined); }}>Cancel editing</button>}
          {message && <Notice error={message.error}>{message.text}</Notice>}
        </form>
      </section>
    </div>
  </>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>('rooms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    api<{ user: User | null }>('/session').then(({ user }) => setUser(user), (error) => setError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await api('/session', { method: 'DELETE' });
      setUser(null);
      setPage('rooms');
    } catch (error) { setError(errorMessage(error)); }
    finally { setSigningOut(false); }
  }

  return <>
    <header className="topbar"><div className="shell topbar-inner">
      <button className="brand" type="button" onClick={() => setPage('rooms')}><span className="brand-mark" aria-hidden="true" />Roombook</button>
      {user && <div className="account"><span>{user.email}</span><button className="secondary" type="button" disabled={signingOut} onClick={() => void signOut()}>Sign out</button></div>}
    </div></header>
    <main className="shell">
      <nav aria-label="Roombook" className="nav">
        <button type="button" aria-current={page === 'rooms' ? 'page' : undefined} onClick={() => setPage('rooms')}>Find a room</button>
        {user && <button type="button" aria-current={page === 'bookings' ? 'page' : undefined} onClick={() => setPage('bookings')}>My bookings</button>}
        {user?.role === 'admin' && <button type="button" aria-current={page === 'manage' ? 'page' : undefined} onClick={() => setPage('manage')}>Manage rooms</button>}
      </nav>
      {error && <Notice error>{error}</Notice>}
      {loading && <Notice>Loading Roombook…</Notice>}
      {!loading && page === 'rooms' && <Rooms user={user} onSignIn={(account) => { setUser(account); setError(''); }} />}
      {page === 'bookings' && user && <MyBookings />}
      {page === 'manage' && user?.role === 'admin' && <ManageRooms />}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
