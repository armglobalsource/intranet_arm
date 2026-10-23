'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Cake, CalendarDays, Sparkles } from 'lucide-react';
import { useBirthdays } from '@/hooks/useUsers';
import { useAuthStore } from '@/lib/store/auth.store';
import { localDayKey, parseBirthday, upcomingBirthdays, type UpcomingBirthday } from '@/lib/birthdays';

function BirthdayAvatar({ person }: { person: UpcomingBirthday['person'] }) {
  const [failed, setFailed] = useState(false);
  return person.avatarUrl && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.avatarUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="h-11 w-11 shrink-0 rounded-full object-cover" />
  ) : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800" aria-hidden="true">
    {((person.firstName?.[0] ?? '') + (person.lastName?.[0] ?? '')).toUpperCase() || '?'}
  </span>;
}

function BirthdayPeople({ items, today, currentUserId }: { items: UpcomingBirthday[]; today?: boolean; currentUserId?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 6);
  return <>
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(({ person, date, daysAway, leapDayObserved }) => <li key={person.id} className={'flex min-w-0 items-center gap-3 rounded-2xl border p-3 sm:p-4 ' + (today ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')}>
        <BirthdayAvatar key={`${person.id}-${person.avatarUrl}`} person={person} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-900">{person.firstName} {person.lastName}{String(person.id) === String(currentUserId) && <span className="ml-1 text-xs font-medium text-violet-700">(Tú)</span>}</p>
          <p className="mt-1 text-xs text-slate-600">{date.toLocaleDateString('es', { day: 'numeric', month: 'long' })}</p>
          <p className={'mt-1 text-xs font-semibold ' + (today ? 'text-amber-800' : 'text-violet-700')}>{today ? '¡Hoy celebramos tu vida!' : daysAway === 1 ? 'Mañana' : `En ${daysAway} días`}</p>
          {leapDayObserved && <p className="mt-1 text-xs text-slate-500">Nació el 29 de febrero; este año celebramos el 1 de marzo.</p>}
        </div>
        {today && <span className="text-xl" aria-hidden="true">🎂</span>}
      </li>)}
    </ul>
    {items.length > 6 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="mt-3 min-h-[44px] rounded-lg px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50">
      {expanded ? 'Ver menos' : `Ver ${items.length - 6} cumpleaños más`}
    </button>}
  </>;
}

export function BirthdayPanel() {
  const { data: people = [], isLoading, isError, refetch } = useBirthdays();
  const user = useAuthStore((s) => s.user);
  const [dayKey, setDayKey] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setDayKey(localDayKey());
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const birthdays = useMemo(() => dayKey ? upcomingBirthdays(people, new Date(`${dayKey}T12:00:00`)) : [], [people, dayKey]);
  const today = birthdays.filter((b) => b.daysAway === 0);
  const upcoming = birthdays.filter((b) => b.daysAway > 0);
  const myBirthday = today.some((b) => String(b.person.id) === String(user?.id));

  return <section aria-labelledby="birthday-heading" className="min-w-0 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Cake size={23} aria-hidden="true" /></span>
        <div><h2 id="birthday-heading" className="text-lg font-bold text-slate-900">Celebramos juntos</h2>
          <p className="mt-1 text-sm text-slate-600">Los cumpleaños de nuestra familia ARM.</p></div>
      </div>
      <Link href="/dashboard/calendario" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"><CalendarDays size={16} aria-hidden="true" /> Ver calendario</Link>
    </div>

    {isLoading || !dayKey ? <p role="status" className="mt-5 text-sm text-slate-600">Buscando las próximas celebraciones…</p>
      : isError ? <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>No pudimos cargar los cumpleaños.</p><button onClick={() => void refetch()} className="mt-2 min-h-[44px] rounded-lg px-3 font-semibold underline">Reintentar cumpleaños</button>
      </div>
      : <>
        {myBirthday && <div className="mt-5 rounded-2xl bg-violet-700 p-5 text-white">
          <p className="flex items-center gap-2 text-lg font-bold"><Sparkles className="shrink-0" size={20} aria-hidden="true" />¡Feliz cumpleaños, {user?.preferredName || user?.firstName}!</p>
          <p className="mt-2 text-sm text-violet-100">Damos gracias a Dios por tu vida. ¡Qué alegría compartir este nuevo año contigo!</p>
        </div>}
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Hoy{today.length > 0 ? ` · ${today.length}` : ''}</h3>
          {today.length ? <BirthdayPeople items={today} today currentUserId={user?.id} /> : <p className="rounded-xl border border-dashed border-violet-200 bg-white/70 px-4 py-3 text-sm text-slate-600">Hoy no hay cumpleaños registrados. Siempre hay una próxima ocasión para celebrar.</p>}
        </div>
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Próximos 30 días{upcoming.length > 0 ? ` · ${upcoming.length}` : ''}</h3>
          {upcoming.length ? <BirthdayPeople items={upcoming} currentUserId={user?.id} /> : <p className="text-sm text-slate-600">No hay cumpleaños registrados para los próximos 30 días.</p>}
        </div>
      </>}
    {user && !parseBirthday(user.birthDate) && <p className="mt-5 border-t border-violet-100 pt-4 text-sm text-slate-600">¡Queremos celebrar contigo! <Link href="/dashboard/perfil" className="inline-block min-h-[44px] py-3 font-semibold text-violet-700 underline underline-offset-4">Agrega tu fecha de nacimiento en tu perfil</Link>.</p>}
  </section>;
}
