'use client';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '@/lib/api';
import { EventLanding } from '@/components/events/EventLanding';
import { PublicEvent } from '@/components/events/event-types';
export default function Page({params}:{params:{slug:string}}){
 const query=useQuery({queryKey:['public-event',params.slug],retry:false,queryFn:()=>axios.get<PublicEvent>(`${api.defaults.baseURL}/public-events/${encodeURIComponent(params.slug)}`).then(r=>r.data)});
 if(query.isPending)return <main className="min-h-screen bg-slate-50 text-slate-700 grid place-items-center" role="status">Cargando evento…</main>;
 if(query.isError)return <main className="min-h-screen bg-slate-50 text-slate-700 flex flex-col items-center justify-center text-center p-6 gap-4"><h1 className="text-2xl font-semibold">{(query.error as any)?.response?.status===404?'Este evento no está disponible':'No pudimos cargar este evento'}</h1><p>Comprueba el enlace o vuelve a intentarlo en unos minutos.</p><button className="rounded-lg border border-slate-300 bg-white px-5 py-3" onClick={()=>query.refetch()}>Volver a intentar</button></main>;
 return <EventLanding event={query.data}/>;
}
