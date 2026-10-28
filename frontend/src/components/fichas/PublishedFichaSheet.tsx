import React from 'react';
import type { Ficha, Row, SectionName } from '@/types/ficha';
import type { Paleta } from '@/hooks/usePaletas';
import { hasContent, momentTree } from '@/lib/ficha-timing';
import { parseSetListEntry } from '@/lib/ficha-setlist';

function value(row: Row, id: string) { return (row.shared ? row.values?.shared ?? row.values?.[id] : row.values?.[id])?.trim() ?? ''; }
function song(row: Row, id: string) {
  const raw = value(row, id);
  const s = parseSetListEntry(row, raw);
  const moment = row.type !== 'song';
  return <span className={`sheet-song${moment ? ' sheet-moment' : ''}`}><span>{moment && <small className="sheet-moment-label">Momento</small>}{s.titulo}{s.cantante && <small>{s.cantante}</small>}</span>{!moment && s.tonalidad && <b className="sheet-key">{s.tonalidad}</b>}</span>;
}
function pairs(rows: Row[]) { const result: Row[][] = []; for (let i = 0; i < rows.length; i += 2) result.push(rows.slice(i, i + 2)); return result; }

export function PublishedFichaSheet({ ficha, colId, hidden, order, paletas }: {
  ficha: Ficha; colId: string; hidden: SectionName[]; order?: string[]; paletas: Paleta[];
}) {
  const rows = (section: SectionName) => hidden.includes(section) ? [] : [...(ficha.sections?.[section]?.rows ?? [])].sort((a,b) => a.order - b.order);
  const assigned = (section: SectionName) => rows(section).filter(r => value(r, colId));
  const responsibilities = (r: Row) => ['pr1','pr2','pr3'].includes(r.id) || /productor general|responsable t[eé]cnico|encargado t[eé]cnico|productor (del |de los )?encuentro/i.test(r.label);
  const roleRows = (data: Row[]) => data.map(r => <tr key={r.id}><th scope="row">{r.label}</th><td>{value(r,colId)}</td></tr>);
  const table = (title: string, data: Row[]) => data.length ? <table className="sheet-roles"><caption>{title}</caption><colgroup><col style={{width: '27%'}} /><col /></colgroup><tbody>{roleRows(data)}</tbody></table> : null;
  const grid = (title: string, data: Row[]) => data.length ? <table className="sheet-pairs"><caption>{title}</caption><colgroup>{[20,30,20,30].map((width,i) => <col key={i} style={{width: `${width}%`}} />)}</colgroup><tbody>{pairs(data).map((pair, i) => <tr key={i}>{pair.map(r => <React.Fragment key={r.id}><th>{r.label}</th><td>{value(r,colId)}</td></React.Fragment>)}{pair.length === 1 && <><td colSpan={2}></td></>}</tr>)}</tbody></table> : null;
  const production = assigned('produccion');
  const positions = assigned('escena').filter(r => /posici[oó]n|izquierda|centro|derecha/i.test(r.label));
  const band = assigned('escena').filter(r => !positions.includes(r));
  const songs = rows('setList').filter(r => value(r,colId)).map(r => song(r,colId));
  const outfit = rows('outfit').map(r => value(r,colId)).filter(Boolean).map(id => paletas.find(p => p.id === id)?.name ?? id);
  const moments = momentTree(rows('horarios'), colId, true).flatMap(n => [n, ...n.children]).filter(m => hasContent(m.value));
  const slots: Record<string, React.ReactNode> = {
    pastoral: (ficha.encuentros?.length ?? 0) > 1 && rows('pastoral').some(r => ficha.encuentros.some(e => value(r,e.id))) ? <table><caption>Encuentro · Plataforma</caption><colgroup><col style={{width: '27%'}} />{ficha.encuentros.map(e => <col key={e.id} />)}</colgroup><thead><tr><th scope="col">Asignación</th>{ficha.encuentros.map(e => <th scope="col" key={e.id}>{e.time || e.label}</th>)}</tr></thead><tbody>{rows('pastoral').filter(r => ficha.encuentros.some(e => value(r,e.id))).map(r => <tr key={r.id}><th scope="row">{r.label}</th>{ficha.encuentros.map(e => <td key={e.id}>{value(r,e.id)}</td>)}</tr>)}</tbody></table> : table('Encuentro · Plataforma', assigned('pastoral')),
    responsables: table('Responsables', production.filter(responsibilities)),
    streaming: grid('Equipo streaming', assigned('streaming')),
    produccion: grid('Equipo técnico', production.filter(r => !responsibilities(r))),
    media: grid('Media', assigned('media')),
    anuncios: table('Información especial', assigned('anuncios')),
    voluntarios: grid('Voluntarios', assigned('voluntarios')),
    worship: band.length || positions.length || songs.length || outfit.length ? <table className="sheet-worship"><caption>AR Worship / Banda</caption><colgroup>{[20,30,25,25].map((width,i) => <col key={i} style={{width: `${width}%`}} />)}</colgroup><tbody>
      {positions.length > 0 && <tr><td colSpan={4}><div className="sheet-positions">{positions.map((r,i) => <div key={r.id}><b className="sheet-position-circle" aria-hidden="true">{i + 1}</b><b>{r.label}</b><span>{value(r,colId)}</span></div>)}</div></td></tr>}
      <tr className="sheet-subhead"><th colSpan={2}>Equipo</th><th colSpan={2}>Canciones · Set list</th></tr>
      {Array.from({length: Math.max(band.length,songs.length)}, (_, i) => <tr key={i}><th>{band[i]?.label ?? ''}</th><td>{band[i] ? value(band[i],colId) : ''}</td><td colSpan={2}>{songs[i] && <div className="sheet-song-row"><span className="sheet-song-number">{String(i+1).padStart(2,'0')}</span>{songs[i]}</div>}</td></tr>)}
      {outfit.length > 0 && <tr><th>Outfit</th><td colSpan={3}>{outfit.join(' · ')}</td></tr>}
    </tbody></table> : null,
    horarios: moments.length ? <table><caption>Horarios</caption><colgroup><col style={{width:'10%'}} /><col style={{width:'10%'}} /><col style={{width:'30%'}} /><col /></colgroup><thead><tr><th scope="col">Inicio</th><th scope="col">Término</th><th scope="col">Momento</th><th scope="col">Responsable / Indicaciones</th></tr></thead><tbody>
      {moments.map(m => <tr key={m.row.id}><td className="sheet-time">{m.value.inicio || '—'}</td><td className="sheet-time">{m.value.fin || '—'}</td><th scope="row">{m.label}</th><td>{[m.value.responsable, m.value.nota].filter(Boolean).join(' · ')}</td></tr>)}
    </tbody></table> : null,
  };
  const defaults = ['pastoral','responsables','streaming','produccion','media','anuncios','worship','horarios','voluntarios'];
  const saved = (order ?? []).filter((id, i, all) => defaults.includes(id) && all.indexOf(id) === i);
  return <div className="published-sheet" aria-label="Ficha técnica en formato de hoja">
    {[...saved, ...defaults.filter(id => !saved.includes(id))].map(id => slots[id] ? <section key={id} data-block-id={id}>{slots[id]}</section> : null)}
  </div>;
}
