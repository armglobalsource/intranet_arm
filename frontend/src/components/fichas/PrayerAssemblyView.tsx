'use client';

import {useEffect, useState} from 'react';
import type {Ficha, LayoutVisualPatch} from '@/types/ficha';
import {VisualReferencePicker} from './VisualReferencePicker';

export function PrayerAssemblyView({ficha, editable, onSave}: {ficha: Ficha; editable: boolean; onSave?: (patch: LayoutVisualPatch) => void}) {
  const remote = JSON.stringify(ficha.layoutVisual?.assemblyReferenceIds ?? []);
  const [ids, setIds] = useState<number[]>(ficha.layoutVisual?.assemblyReferenceIds ?? []);
  useEffect(() => { setIds(JSON.parse(remote)); }, [remote]);
  return <section className="prayer-assembly" aria-label="Montaje de sala" style={{padding: '20px 24px'}}>
    <h2 style={{fontSize: 18, fontWeight: 700, color: '#293443', marginBottom: 8}}>Montaje de sala · Oración</h2>
    <p style={{fontSize: 12, color: '#526071', lineHeight: 1.6, marginBottom: 18}}>Imagen de referencia para ubicar las sillas y preparar la sala antes del encuentro.</p>
    <VisualReferencePicker value={ids} onChange={next => { setIds(next); onSave?.({assemblyReferenceIds: next}); }} editable={editable} max={1} variant="assembly" />
    {!ids.length && <p style={{marginTop: 12, fontSize: 13, color: '#687587'}}>{editable ? 'Agrega la imagen del montaje desde el catálogo o sube una nueva referencia.' : 'El equipo aún no ha agregado una imagen del montaje.'}</p>}
  </section>;
}
