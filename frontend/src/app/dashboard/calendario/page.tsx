import Link from 'next/link';
import { ChevronLeft, CalendarDays } from 'lucide-react';
import { CalendarioAnual } from '../CalendarioAnual';

export default function CalendarioPage() {
  return (
    <main className="min-h-screen -m-6 bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link
          href="/dashboard"
          className="group inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          Volver al inicio
        </Link>

        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Planificación</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Calendario</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Consulta encuentros, actividades y cumpleaños de la organización.
              </p>
            </div>
          </div>
        </header>

        <CalendarioAnual />
      </div>
    </main>
  );
}
