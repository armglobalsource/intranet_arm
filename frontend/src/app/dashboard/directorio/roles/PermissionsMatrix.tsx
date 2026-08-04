'use client';

import { useEffect, useState } from 'react';
import { PERMISSION_CATALOG, PERMISSION_UI_CONFIG } from '@/lib/permissions';
import { useUpdateRole, type SystemRole } from '@/hooks/useRoles';

// ── Construcción de filas a partir del catálogo de permisos ───────────────────
// Cada recurso produce una fila "Ver" (la fila padre) y, si tiene, sub-filas
// para "Editar" y cualquier permiso extra — todas siempre visibles (sin
// esconder nada detrás de un clic), a diferencia del modal anterior.

interface MatrixRow {
  resource: string;
  kind:     'view' | 'edit' | 'extra';
  label:    string;
  sub:      string | null; // breadcrumb, solo en la fila padre
  actions:  string[];
}

function buildRows(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  Object.entries(PERMISSION_UI_CONFIG).forEach(([resource, uiCfg]) => {
    const cfg = (PERMISSION_CATALOG as any)[resource];
    if (!cfg) return;
    rows.push({
      resource, kind: 'view', label: cfg.label,
      sub: uiCfg.breadcrumb.length > 0 ? uiCfg.breadcrumb.join(' › ') : null,
      actions: uiCfg.viewActions,
    });
    if (uiCfg.editActions.length > 0) {
      rows.push({ resource, kind: 'edit', label: 'Editar', sub: null, actions: uiCfg.editActions });
    }
    uiCfg.extra?.forEach((ex: { key: string; label: string; actions: string[] }) => {
      rows.push({ resource, kind: 'extra', label: ex.label, sub: null, actions: ex.actions });
    });
  });
  return rows;
}

const ROWS = buildRows();

function isWildcard(role: SystemRole) { return role.permissions.includes('*'); }

function isRowOn(role: SystemRole, row: MatrixRow): boolean {
  if (isWildcard(role)) return true;
  return row.actions.length > 0 && row.actions.every((a) => role.permissions.includes(`${row.resource}:${a}`));
}

// ── Celda de toggle ───────────────────────────────────────────────────────────

function Cell({ on, locked, onClick }: { on: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      title={locked ? 'Este rol tiene acceso total' : undefined}
      className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
        locked ? 'cursor-default' : 'cursor-pointer active:scale-90'
      } ${on ? 'bg-indigo-600' : 'border-2 border-slate-200 hover:border-slate-300'}`}
    >
      {on ? (
        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg className="w-2.5 h-2.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      )}
    </button>
  );
}

// ── Matriz ────────────────────────────────────────────────────────────────────

interface PermissionsMatrixProps {
  roles: SystemRole[];
}

export function PermissionsMatrix({ roles }: PermissionsMatrixProps) {
  const update = useUpdateRole();

  // Estado optimista local — se resincroniza cuando React Query trae datos frescos
  const [localRoles, setLocalRoles] = useState(roles);
  useEffect(() => setLocalRoles(roles), [roles]);

  function persist(role: SystemRole, permissions: string[]) {
    const prev = role.permissions;
    setLocalRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions } : r)));
    update.mutate(
      { id: role.id, data: { permissions } },
      { onError: () => setLocalRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions: prev } : r))) },
    );
  }

  function toggleCell(role: SystemRole, row: MatrixRow) {
    if (isWildcard(role)) return;
    const set = new Set(role.permissions);
    const turningOn = !isRowOn(role, row);
    row.actions.forEach((a) => {
      const p = `${row.resource}:${a}`;
      turningOn ? set.add(p) : set.delete(p);
    });
    const uiCfg = PERMISSION_UI_CONFIG[row.resource];
    if (row.kind === 'view' && !turningOn) {
      uiCfg.editActions.forEach((a) => set.delete(`${row.resource}:${a}`));
    }
    if (row.kind === 'edit' && turningOn) {
      uiCfg.viewActions.forEach((a) => set.add(`${row.resource}:${a}`));
    }
    persist(role, Array.from(set));
  }

  function toggleWildcard(role: SystemRole) {
    if (isWildcard(role)) {
      if (!confirm(`¿Quitar el acceso total de "${role.name}"? Tendrás que activar cada permiso de nuevo.`)) return;
      persist(role, []);
    } else {
      if (!confirm(`¿Dar acceso total a "${role.name}"? Podrá hacer todo en el sistema sin restricciones.`)) return;
      persist(role, ['*']);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <p className="text-[12.5px] font-medium text-slate-600">Haz clic en un círculo para activar o desactivar el acceso — se guarda al instante.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap border-r border-slate-200">
                Ítem de menú
              </th>
              {localRoles.map((role) => (
                <th key={role.id} className="px-3 py-2 text-center align-top" style={{ minWidth: 108 }}>
                  <p className="text-[11.5px] font-bold font-mono text-slate-800 truncate max-w-[120px] mx-auto" title={role.name}>{role.name}</p>
                  <button
                    onClick={() => toggleWildcard(role)}
                    className={`mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
                      isWildcard(role) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-300 hover:text-slate-500'
                    }`}
                  >
                    {isWildcard(role) ? '✦ Total' : 'Dar acceso total'}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const isParent = row.kind === 'view';
              return (
                <tr key={`${row.resource}-${row.kind}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="sticky left-0 z-20 bg-white px-4 py-2 whitespace-nowrap border-r border-slate-200">
                    {isParent ? (
                      <div>
                        <p className="text-[12.5px] font-semibold text-slate-800">{row.label}</p>
                        {row.sub && <p className="text-[10px] text-slate-400">{row.sub}</p>}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-slate-500 pl-4">↳ {row.label}</p>
                    )}
                  </td>
                  {localRoles.map((role) => (
                    <td key={role.id} className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        <Cell on={isRowOn(role, row)} locked={isWildcard(role)} onClick={() => toggleCell(role, row)} />
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
