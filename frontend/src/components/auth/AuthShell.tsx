import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const authInput = 'w-full min-h-[50px] rounded-xl border border-[#cdd6d0] bg-white px-4 py-3 text-base text-[#182d25] placeholder:text-[#77857e] outline-none transition focus:border-[#315e49] focus:ring-2 focus:ring-[#315e49]/20 disabled:opacity-60';
export const authButton = 'flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#204b39] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#163a2b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315e49] disabled:cursor-wait disabled:opacity-60';
export const authLink = 'font-semibold text-[#28563f] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315e49]';

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#f4f5f1] text-[#182d25] selection:bg-[#dce9d9]" style={{ colorScheme: 'light' }}>
      <div className="mx-auto grid min-h-[100dvh] max-w-[1920px] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden min-h-[100dvh] flex-col justify-between overflow-hidden bg-[#d9ddd1] p-12 lg:flex xl:p-16">
          <Image src="/auth-architecture.webp" alt="" fill priority sizes="55vw" className="object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#f7f6f0]/65 via-[#f5f4ed]/15 to-[#142a20]/80" />
          <Image src="/logo.png" alt="ARM Global" width={176} height={62} className="relative z-10 h-auto w-40 object-contain brightness-0" priority />
          <div className="relative z-10 max-w-xl text-white">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Ecosistema ARM</p>
            <h2 className="text-5xl font-medium leading-[1.1] tracking-[-0.045em] xl:text-6xl">Un espacio para<br />caminar juntos.</h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-white/85">Conectamos personas, equipos y propósitos en un mismo lugar.</p>
            <div className="mt-10 h-px w-full max-w-sm bg-white/40" />
            <p className="mt-5 text-sm text-white/80">ARM Global · Nuestra comunidad</p>
          </div>
        </aside>
        <section className="flex min-h-[100dvh] min-w-0 flex-col px-5 pb-6 pt-7 sm:px-10 sm:py-10 lg:px-16 xl:px-24">
          <div className="mx-auto flex w-full max-w-[440px] items-center justify-between gap-4 lg:justify-end">
            <Image src="/logo.png" alt="ARM Global" width={126} height={44} className="h-auto w-28 brightness-0 sm:w-32 lg:hidden" priority />
            <span className="text-right text-[11px] font-medium tracking-wide text-[#627369] sm:text-xs">Tu comunidad, más cerca.</span>
          </div>
          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10 sm:py-14">
            <div className="relative mb-8 h-24 overflow-hidden rounded-2xl bg-[#d9ddd1] sm:h-32 lg:hidden">
              <Image src="/auth-architecture.webp" alt="" fill sizes="(max-width: 640px) 90vw, 440px" className="object-cover object-center" priority />
              <div aria-hidden="true" className="absolute inset-0 bg-[#1c3929]/15" />
            </div>
            <div className="rounded-[20px] border border-[#e1e7df] bg-white p-5 shadow-[0_12px_40px_rgba(31,55,41,0.05)] sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#617260]">Bienvenido a casa</p>
              <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{title}</h1>
              <p className="mb-7 mt-3 text-sm leading-6 text-[#607068] sm:mb-9">{description}</p>
              {children}
            </div>
          </div>
          <footer className="text-center text-xs leading-6 text-[#66766d]">ARM Global · Hecho para nuestra comunidad<br /><Link href="/politicas" className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">Privacidad y condiciones</Link></footer>
        </section>
      </div>
    </main>
  );
}
