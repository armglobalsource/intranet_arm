import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const authInput = 'w-full min-h-[50px] rounded-xl border border-[#cdd6d0] bg-white px-4 py-3 text-base text-[#182d25] placeholder:text-[#77857e] outline-none transition focus:border-[#315e49] focus:ring-2 focus:ring-[#315e49]/20 disabled:opacity-60';
export const authButton = 'flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#204b39] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#163a2b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315e49] disabled:cursor-wait disabled:opacity-60';
export const authLink = 'font-semibold text-[#28563f] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315e49]';

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fafbf8] text-[#182d25] selection:bg-[#dce9d9]" style={{ colorScheme: 'light' }}>
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1fr_1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-[#e1e7dd] bg-[#eef2e8] p-12 lg:flex xl:p-20">
          <Image src="/logo.png" alt="ARM Global" width={176} height={62} className="h-auto w-44 object-contain brightness-0" priority />
          <div className="relative z-10 my-16 max-w-lg">
            <span className="mb-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#52654f]"><span className="h-2 w-2 rounded-full bg-[#52784d]" />Ecosistema ARM</span>
            <h2 className="text-5xl font-medium leading-[1.13] tracking-[-0.045em] xl:text-6xl">Un mismo corazón.<br /><span className="text-[#68815d]">Un lugar para conectar.</span></h2>
            <p className="mt-7 max-w-sm text-base leading-7 text-[#52634f]">Tu comunidad, tus equipos y todo lo que hacemos juntos, en un solo lugar.</p>
          </div>
          <p className="relative z-10 text-sm text-[#596b53]">Conectamos personas. Servimos juntos.</p>
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-44 h-[480px] w-[480px] rounded-full border border-[#dce4d2]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-28 h-[350px] w-[350px] rounded-full border border-[#dce4d2]" />
        </aside>
        <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
          <div className="flex items-center justify-between lg:justify-end">
            <Image src="/logo.png" alt="ARM Global" width={126} height={44} className="h-auto w-32 brightness-0 lg:hidden" priority />
            <span className="text-xs font-medium tracking-wide text-[#627369]">Tu comunidad, más cerca.</span>
          </div>
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#617260]">Bienvenido a casa</p>
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{title}</h1>
            <p className="mb-9 mt-3 text-sm leading-6 text-[#607068]">{description}</p>
            {children}
          </div>
          <footer className="text-center text-xs leading-6 text-[#66766d]">ARM Global · Hecho para nuestra comunidad<br /><Link href="/politicas" className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">Privacidad y condiciones</Link></footer>
        </section>
      </div>
    </main>
  );
}
