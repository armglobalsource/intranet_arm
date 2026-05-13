'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { api } from '@/lib/api';
import {
  useOrgAreas, useOrgAreaTree, useOrgSearch,
  useUpdateOrgArea, useUpdateOrgTeam,
  useCreateOrgMembership, useDeleteOrgMembership,
  useUploadTeamLogo,
} from '@/hooks/useOrgChart';
import type { OrgArea, OrgAreaTree, OrgTeam, OrgMembership, OrgUser, OrgSearchUser, OrgRole } from '@/types/orgchart';
import { orgUserJobTitle } from '@/types/orgchart';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(u: OrgUser) {
  return (u.firstName[0] + u.lastName[0]).toUpperCase();
}

function fullName(u: OrgUser) {
  return `${u.firstName} ${u.lastName}`;
}

const ROLE_LABEL: Record<OrgRole, string> = {
  area_leader: 'Líder de Área',
  team_leader: 'Líder de Equipo',
  member:      'Miembro',
};

// ── UserAvatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ user, color, size = 38 }: { user: OrgUser; color: string; size?: number }) {
  const sz = `${size}px`;
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt={fullName(user)} className="rounded-full object-cover flex-shrink-0" style={{ width: sz, height: sz }} />
    );
  }
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ width: sz, height: sz, background: color }}>
      {initials(user)}
    </div>
  );
}

// ── MemberCard ─────────────────────────────────────────────────────────────────

interface MemberCardProps {
  membership: OrgMembership;
  color:      string;
  canEdit:    boolean;
  onSelect:   (m: OrgMembership) => void;
  onRemove:   (id: number) => void;
}

function MemberCard({ membership, color, canEdit, onSelect, onRemove }: MemberCardProps) {
  const { user, role } = membership;
  const isLeader = role === 'team_leader';
  const isInactive = user.status !== 'active';

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 shadow-sm cursor-pointer group transition-shadow hover:shadow-md border ${
        isLeader
          ? 'bg-white border-l-[3px]'
          : isInactive
          ? 'bg-orange-50 border-dashed border-orange-200'
          : 'bg-white border-slate-200'
      }`}
      style={isLeader ? { borderLeftColor: color } : {}}
      onClick={() => onSelect(membership)}
    >
      <div className="relative flex-shrink-0">
        <UserAvatar user={user} color={color} size={36} />
        {isLeader && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center" style={{ background: color }}>
            <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold leading-snug truncate ${isInactive ? 'text-orange-700' : 'text-slate-900'}`}>
          {fullName(user)}
        </div>
        <div className="text-[10.5px] font-medium uppercase tracking-wide mt-0.5 text-slate-400 truncate">
          {orgUserJobTitle(user) ?? ROLE_LABEL[role]}
        </div>
      </div>

      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(membership.id); }}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Quitar del equipo"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── TeamCard ───────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team:         OrgTeam;
  color:        string;
  canEdit:      boolean;
  forceOpen:    boolean | null;
  isDragging?:  boolean;
  dragHandle?:  React.ReactNode;
  onSelect:     (m: OrgMembership) => void;
  onSelectTeam: (t: OrgTeam) => void;
}

function TeamCard({ team, color, canEdit, forceOpen, isDragging, dragHandle, onSelect, onSelectTeam }: TeamCardProps) {
  const [open,     setOpen]     = useState(true);
  const [descOpen, setDescOpen] = useState(false);
  const deleteMembership = useDeleteOrgMembership();

  useEffect(() => {
    if (forceOpen !== null) {
      setOpen(forceOpen);
      setDescOpen(forceOpen);
    }
  }, [forceOpen]);

  const leaders = team.memberships.filter((m) => m.role === 'team_leader');
  const members = team.memberships.filter((m) => m.role === 'member');

  function handleRemove(id: number) {
    if (window.confirm('¿Quitar esta persona del equipo?')) {
      deleteMembership.mutate(id);
    }
  }

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* Header del equipo */}
      <div
        className="flex items-center gap-2.5 bg-slate-800 rounded-[10px] px-3 py-2.5 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => onSelectTeam(team)}
      >
        {/* Drag handle — solo en modo edición */}
        {dragHandle}

        <div className="w-[36px] h-[36px] rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center text-base overflow-hidden">
          {team.iconUrl
            ? <img src={team.iconUrl} alt={team.name} className="w-full h-full object-cover" />
            : (team.icon ?? '👥')
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white leading-snug truncate">{team.name}</div>
          <div className="text-[10.5px] text-white/40 mt-0.5 uppercase tracking-wide">
            {leaders.length} líder{leaders.length !== 1 ? 'es' : ''} · {members.length} miembro{members.length !== 1 ? 's' : ''}
          </div>
        </div>

        {team.desc && (
          <button
            onClick={(e) => { e.stopPropagation(); setDescOpen((v) => !v); }}
            className={`w-[22px] h-[22px] rounded-md flex-shrink-0 border flex items-center justify-center text-[11px] font-bold italic font-serif transition-all ${
              descOpen ? 'text-white border-transparent' : 'border-white/20 text-white/40 hover:bg-white/10'
            }`}
            style={descOpen ? { background: color, borderColor: color } : {}}
            title="Ver descripción"
          >
            i
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={`w-7 h-7 rounded-[7px] flex-shrink-0 border flex items-center justify-center transition-all ${
            open ? 'text-white border-transparent' : 'border-white/20 text-white/40 hover:bg-white/10'
          }`}
          style={open ? { background: color, borderColor: color } : {}}
        >
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Descripción */}
      {descOpen && team.desc && (
        <div className="text-[12.5px] leading-relaxed rounded-b-[9px] px-3.5 py-2.5 whitespace-pre-line border border-t-0 mt-[-2px] mb-1 text-slate-500" style={{ background: `${color}08`, borderColor: `${color}30` }}>
          {team.desc}
        </div>
      )}

      {/* Miembros */}
      {open && (
        <div className="ml-[18px] pl-[26px] mt-1.5 flex flex-col gap-1.5 border-l-2" style={{ borderColor: `${color}2a` }}>
          {leaders.map((m) => (
            <MemberCard key={m.id} membership={m} color={color} canEdit={canEdit} onSelect={onSelect} onRemove={handleRemove} />
          ))}
          {members.map((m) => (
            <MemberCard key={m.id} membership={m} color={color} canEdit={canEdit} onSelect={onSelect} onRemove={handleRemove} />
          ))}
          {team.memberships.length === 0 && (
            <p className="text-xs text-slate-400 italic px-2 py-1">Sin miembros asignados</p>
          )}
        </div>
      )}
    </div>
  );
}


// ── AreaLeaderCard ─────────────────────────────────────────────────────────────

function AreaLeaderCard({ membership, color, onSelect }: { membership: OrgMembership; color: string; onSelect: (m: OrgMembership) => void }) {
  const { user } = membership;
  return (
    <div
      className="flex items-center gap-3 bg-white border-l-[3px] rounded-[10px] px-4 py-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow flex-shrink-0"
      style={{ borderLeftColor: color }}
      onClick={() => onSelect(membership)}
    >
      <UserAvatar user={user} color={color} size={40} />
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 leading-snug truncate max-w-[160px]">{fullName(user)}</div>
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400 mt-0.5 truncate">{orgUserJobTitle(user) ?? 'Líder'}</div>
      </div>
      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: color }}>
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </div>
  );
}

// ── TreeView ───────────────────────────────────────────────────────────────────

interface TreeViewProps {
  data:         OrgAreaTree;
  canEdit:      boolean;
  onSelectUser: (m: OrgMembership) => void;
  onSelectTeam: (t: OrgTeam) => void;
}

function TreeView({ data, canEdit, onSelectUser, onSelectTeam }: TreeViewProps) {
  const updateTeam = useUpdateOrgTeam();

  const [localTeams, setLocalTeams] = useState<OrgTeam[]>(data.teams);
  useEffect(() => { setLocalTeams(data.teams); }, [data.teams]);

  const [forceOpen, setForceOpen] = useState<boolean | null>(null);

  const maxCol = Math.max(1, ...localTeams.map((t) => t.colPosition ?? 1));
  const byCol: Record<number, OrgTeam[]> = {};
  for (let c = 1; c <= maxCol; c++) byCol[c] = [];
  localTeams.forEach((t) => { byCol[t.colPosition ?? 1].push(t); });
  // sort each column by sortOrder
  Object.values(byCol).forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));

  function swapInCol(teamId: number, dir: 'up' | 'down') {
    const col = localTeams.find((t) => t.id === teamId)?.colPosition ?? 1;
    const colArr = [...byCol[col]];
    const idx = colArr.findIndex((t) => t.id === teamId);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= colArr.length) return;

    [colArr[idx], colArr[swapIdx]] = [colArr[swapIdx], colArr[idx]];

    const updated = localTeams.map((t) => {
      const ni = colArr.findIndex((c) => c.id === t.id);
      return ni !== -1 ? { ...t, sortOrder: ni } : t;
    });
    setLocalTeams(updated);
    updateTeam.mutate({ id: colArr[idx].id,     data: { sortOrder: idx } });
    updateTeam.mutate({ id: colArr[swapIdx].id, data: { sortOrder: swapIdx } });
  }

  function changeCol(teamId: number, delta: number) {
    const team = localTeams.find((t) => t.id === teamId);
    if (!team) return;
    const newCol = (team.colPosition ?? 1) + delta;
    if (newCol < 1 || newCol > maxCol + 1) return;

    // Put at end of target column
    const targetColTeams = localTeams.filter((t) => t.id !== teamId && (t.colPosition ?? 1) === newCol);
    const newSortOrder = targetColTeams.length;

    const updated = localTeams.map((t) =>
      t.id === teamId ? { ...t, colPosition: newCol, sortOrder: newSortOrder } : t,
    );
    setLocalTeams(updated);
    updateTeam.mutate({ id: teamId, data: { colPosition: newCol, sortOrder: newSortOrder } });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controles expand/collapse */}
      {localTeams.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setForceOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-all"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            Expandir todo
          </button>
          <button
            onClick={() => setForceOpen(false)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-all"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
            Contraer todo
          </button>
        </div>
      )}

      {/* Líderes del área */}
      {data.leaders.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.leaders.map((m) => (
            <AreaLeaderCard key={m.id} membership={m} color={data.color} onSelect={onSelectUser} />
          ))}
        </div>
      )}

      {/* Grid de columnas */}
      <div className={`flex flex-col ${maxCol > 1 ? 'lg:flex-row' : ''} gap-3 items-start`}>
        {Array.from({ length: maxCol }, (_, i) => i + 1).map((col) => (
          <div key={col} className="flex flex-col gap-3 flex-1 min-w-0">
            {byCol[col].map((team, idx) => {
              const editControls = canEdit ? (
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Mover arriba/abajo dentro de la columna */}
                  <div className="flex flex-col">
                    <button
                      onClick={(e) => { e.stopPropagation(); swapInCol(team.id, 'up'); }}
                      disabled={idx === 0}
                      className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Subir"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); swapInCol(team.id, 'down'); }}
                      disabled={idx === byCol[col].length - 1}
                      className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Bajar"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                  {/* Mover entre columnas */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); changeCol(team.id, -1); }}
                      disabled={col <= 1}
                      className="w-4 h-6 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-15 disabled:cursor-not-allowed transition-colors"
                      title="Mover a columna anterior"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className="text-[9px] font-bold text-white/25 w-4 text-center">C{col}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); changeCol(team.id, 1); }}
                      disabled={col >= maxCol && byCol[col].length <= 1}
                      className="w-4 h-6 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-15 disabled:cursor-not-allowed transition-colors"
                      title="Mover a columna siguiente"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
              ) : null;

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  color={data.color}
                  canEdit={canEdit}
                  forceOpen={forceOpen}
                  dragHandle={editControls}
                  onSelect={onSelectUser}
                  onSelectTeam={onSelectTeam}
                />
              );
            })}
          </div>
        ))}
      </div>

      {localTeams.length === 0 && (
        <p className="text-slate-400 text-sm p-4">Sin equipos en esta área</p>
      )}
    </div>
  );
}

// ── UserDetailPanel ────────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  membership: OrgMembership;
  color:      string;
  canEdit:    boolean;
  onClose:    () => void;
}

function UserDetailPanel({ membership, color, canEdit, onClose }: UserDetailPanelProps) {
  const { user, role } = membership;
  const [editingUser, setEditingUser] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OrgRole>(role);
  const [saving, setSaving] = useState(false);

  const deleteMembership = useDeleteOrgMembership();
  const createMembership = useCreateOrgMembership();

  function handleSaveRole() {
    if (selectedRole === role) { setEditingUser(false); return; }
    setSaving(true);
    deleteMembership.mutate(membership.id, {
      onSuccess: () => {
        createMembership.mutate(
          { userId: user.id, teamId: membership.teamId ?? undefined, areaId: membership.areaId ?? undefined, role: selectedRole },
          {
            onSuccess: () => { setSaving(false); setEditingUser(false); onClose(); },
            onError:   () => setSaving(false),
          },
        );
      },
      onError: () => setSaving(false),
    });
  }

  function handleRemove() {
    if (window.confirm(`¿Quitar a ${fullName(user)} del equipo? Esta acción no se puede deshacer.`)) {
      deleteMembership.mutate(membership.id, { onSuccess: onClose });
    }
  }

  const ROLES: { value: OrgRole; label: string }[] = [
    { value: 'area_leader', label: 'Líder de Área'  },
    { value: 'team_leader', label: 'Líder de Equipo' },
    { value: 'member',      label: 'Miembro'         },
  ];

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '380px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${color}` }}>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: color }}>
            {ROLE_LABEL[role]}
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <UserAvatar user={user} color={color} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 leading-snug">{fullName(user)}</div>
              {user.jobTitles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.jobTitles.map((jt, i) => (
                    <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                      {jt.jobTitle.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info personal */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-col divide-y divide-slate-100">
              {/* Email */}
              <a href={`mailto:${user.email}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span className="text-[12px] text-slate-600 truncate group-hover:text-blue-600 transition-colors">{user.email}</span>
              </a>
              {/* Teléfono */}
              {user.phone ? (
                <a href={`tel:${user.phone}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-600 group-hover:text-blue-600 transition-colors">{user.phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin teléfono</span>
                </div>
              )}
              {/* País */}
              {user.country ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.country}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin país</span>
                </div>
              )}
              {/* Campus */}
              {user.campus ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.campus.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin campus</span>
                </div>
              )}
            </div>
          </div>

          {/* Biografía */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Biografía</p>
            {user.bio
              ? <p className="text-[12.5px] text-slate-600 leading-relaxed">{user.bio}</p>
              : <p className="text-[12px] text-slate-300 italic">Sin biografía</p>
            }
          </div>

          {/* Campos editables — solo en modo edición */}
          {canEdit && editingUser && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Rol en el equipo</label>
                <div className="flex flex-col gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setSelectedRole(r.value)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left"
                      style={
                        selectedRole === r.value
                          ? { background: color, borderColor: color, color: '#fff' }
                          : { borderColor: '#e2e8f0', color: '#64748b' }
                      }
                    >
                      <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={selectedRole === r.value ? { borderColor: '#fff' } : { borderColor: '#cbd5e1' }}>
                        {selectedRole === r.value && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — acciones admin */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5">
            {!editingUser ? (
              <button
                onClick={() => setEditingUser(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar membresía
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveRole}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: color }}
                >
                  {saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Guardar cambios</>
                  )}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingUser(false); setSelectedRole(role); }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={deleteMembership.isPending}
                    className="px-4 py-2 rounded-xl border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Quitar del equipo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── TeamDetailPanel ────────────────────────────────────────────────────────────

interface TeamDetailPanelProps {
  team:    OrgTeam;
  color:   string;
  canEdit: boolean;
  onClose: () => void;
}

function TeamDetailPanel({ team, color, canEdit, onClose }: TeamDetailPanelProps) {
  const [editingTeam, setEditingTeam] = useState(false);
  const [name,       setName]       = useState(team.name);
  const [desc,       setDesc]       = useState(team.desc ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [addQuery,   setAddQuery]   = useState('');
  const [addResults, setAddResults] = useState<OrgUser[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const updateTeam      = useUpdateOrgTeam();
  const uploadLogo      = useUploadTeamLogo();
  const createMembership = useCreateOrgMembership();
  const deleteMembership = useDeleteOrgMembership();

  const isEditing = canEdit && editingTeam;

  // Search users to add
  useEffect(() => {
    if (addQuery.trim().length < 2) { setAddResults([]); return; }
    setSearching(true);
    const ctrl = new AbortController();
    api.get('/users', { params: { search: addQuery, limit: 8 }, signal: ctrl.signal })
      .then((r) => {
        const d = r.data;
        setAddResults(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [addQuery]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    uploadLogo.mutate({ id: team.id, file });
  }

  function handleSave() {
    setSaveStatus('saving');
    updateTeam.mutate(
      { id: team.id, data: { name, desc } },
      {
        onSuccess: () => { setSaveStatus('saved'); setEditingTeam(false); setTimeout(() => setSaveStatus('idle'), 2500); },
        onError:   () => setSaveStatus('idle'),
      },
    );
  }

  function handleAddMember(user: OrgUser, role: 'team_leader' | 'member') {
    createMembership.mutate(
      { userId: user.id, teamId: team.id, role },
      { onSuccess: () => { setAddQuery(''); setAddResults([]); } },
    );
  }

  function handleRemove(id: number) {
    if (window.confirm('¿Quitar esta persona del equipo?')) deleteMembership.mutate(id);
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '380px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${color}` }}>
          <div className="flex items-center gap-2.5">
            {/* Logo del equipo */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-slate-100 text-xl">
                {logoPreview || team.iconUrl
                  ? <img src={logoPreview ?? team.iconUrl!} alt={team.name} className="w-full h-full object-cover" />
                  : (team.icon ?? '👥')
                }
              </div>
              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadLogo.isPending}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center transition-all disabled:opacity-50"
                    style={{ background: color }}
                    title="Cambiar logo"
                  >
                    {uploadLogo.isPending
                      ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                      : <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    }
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </>
              )}
            </div>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{team.name}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Descripción — solo lectura cuando no está editando */}
          {!isEditing && team.desc && (
            <p className="text-sm text-slate-500 leading-relaxed">{team.desc}</p>
          )}

          {/* Edición del equipo — solo en modo edición */}
          {isEditing && (
            <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre del equipo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Descripción</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm resize-none focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>
          )}

          {/* Miembros actuales */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Miembros ({team.memberships.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {team.memberships.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                  <UserAvatar user={m.user} color={color} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{fullName(m.user)}</p>
                    <p className="text-[10px] text-slate-400">{ROLE_LABEL[m.role]}</p>
                  </div>
                  {isEditing && (
                    <button onClick={() => handleRemove(m.id)} className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1">×</button>
                  )}
                </div>
              ))}
              {team.memberships.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">Sin miembros</p>
              )}
            </div>
          </div>

          {/* Agregar miembro — solo en modo edición */}
          {isEditing && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Agregar persona</p>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              {(addResults.length > 0 || searching) && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                  {searching && <div className="flex justify-center py-3"><div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" /></div>}
                  {addResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0">
                      <UserAvatar user={u} color={color} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{fullName(u)}</p>
                        <p className="text-[10px] text-slate-400 truncate">{orgUserJobTitle(u) ?? u.email}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleAddMember(u, 'team_leader')} className="text-[10px] px-2 py-1 rounded-lg border font-semibold transition-colors hover:text-white" style={{ borderColor: color, color }} onMouseEnter={(e) => (e.currentTarget.style.background = color)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          Líder
                        </button>
                        <button onClick={() => handleAddMember(u, 'member')} className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold transition-colors">
                          Miembro
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — acciones admin */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5">
            {!editingTeam ? (
              <button
                onClick={() => setEditingTeam(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar equipo
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={updateTeam.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: color }}
                >
                  {saveStatus === 'saving' ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Guardar cambios</>
                  )}
                </button>
                <button
                  onClick={() => { setEditingTeam(false); setName(team.name); setDesc(team.desc ?? ''); setAddQuery(''); setAddResults([]); }}
                  className="w-full py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── SearchUserDetailPanel ──────────────────────────────────────────────────────

function SearchUserDetailPanel({ user, areas, onClose }: { user: OrgSearchUser; areas: OrgArea[]; onClose: () => void }) {
  function getArea(areaId?: number | null) {
    return areas.find((a) => a.id === areaId);
  }
  const primaryColor = getArea(user.orgMemberships[0]?.area?.id)?.color ?? '#64748b';

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '400px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${primaryColor}` }}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Perfil del colaborador</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Avatar + nombre + cargos */}
          <div className="flex items-center gap-4">
            <UserAvatar user={user} color={primaryColor} size={60} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 leading-snug">{fullName(user)}</div>
              {user.jobTitles.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.jobTitles.map((jt, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: primaryColor }}>
                      {jt.jobTitle.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-400 italic mt-1">Sin cargo asignado</p>
              )}
            </div>
          </div>

          {/* Áreas y equipos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Pertenece a</p>
            <div className="flex flex-col gap-2">
              {user.orgMemberships.map((m) => {
                const area = getArea(m.area?.id);
                const aColor = area?.color ?? '#64748b';
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50">
                    {area && (
                      <span className="text-base flex-shrink-0">{area.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      {area && (
                        <p className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: aColor }}>{area.name}</p>
                      )}
                      {m.team && (
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{m.team.name}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: aColor }}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                );
              })}
              {user.orgMemberships.length === 0 && (
                <p className="text-xs text-slate-400 italic">Sin membresías en el organigrama</p>
              )}
            </div>
          </div>

          {/* Info de contacto */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-col divide-y divide-slate-100">
              <a href={`mailto:${user.email}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span className="text-[12px] text-slate-600 truncate group-hover:text-blue-600 transition-colors">{user.email}</span>
              </a>
              {user.phone ? (
                <a href={`tel:${user.phone}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-600 group-hover:text-blue-600 transition-colors">{user.phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin teléfono</span>
                </div>
              )}
              {user.country ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.country}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin país</span>
                </div>
              )}
              {user.campus ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.campus.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin campus</span>
                </div>
              )}
            </div>
          </div>

          {/* Biografía */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Biografía</p>
            {user.bio
              ? <p className="text-[12.5px] text-slate-600 leading-relaxed">{user.bio}</p>
              : <p className="text-[12px] text-slate-300 italic">Sin biografía</p>
            }
          </div>
        </div>
      </div>
    </>
  );
}

// ── SearchBar ──────────────────────────────────────────────────────────────────

function SearchBar({ areas, onSelectUser }: { areas: OrgArea[]; onSelectUser: (u: OrgSearchUser) => void }) {
  const [q,      setQ]      = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const wrapRef             = useRef<HTMLDivElement>(null);
  const { data: results, isFetching } = useOrgSearch(q);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDdOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function getArea(areaId?: number | null) {
    return areas.find((a) => a.id === areaId);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 pointer-events-none w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setDdOpen(true); }}
          onFocus={() => q.length >= 2 && setDdOpen(true)}
          placeholder="Buscar persona por nombre o cargo…"
          className="w-full pl-12 pr-12 py-3.5 border-2 border-slate-200 rounded-2xl text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition shadow-sm"
        />
        {isFetching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}
        {q && !isFetching && (
          <button onClick={() => { setQ(''); setDdOpen(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm transition-colors">✕</button>
        )}
      </div>

      {ddOpen && q.length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {!results?.length && !isFetching ? (
            <div className="px-5 py-5 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Sin resultados para &ldquo;{q}&rdquo;
            </div>
          ) : (
            results?.map((u) => {
              const firstArea = getArea(u.orgMemberships[0]?.area?.id);
              const color = firstArea?.color ?? '#64748b';
              return (
                <button
                  key={u.id}
                  onMouseDown={() => { onSelectUser(u); setDdOpen(false); setQ(''); }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left transition-colors"
                >
                  <UserAvatar user={u} color={color} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{fullName(u)}</div>
                    {u.jobTitles.length > 0 && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.jobTitles[0].jobTitle.name}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.orgMemberships.slice(0, 3).map((m, i) => {
                        const a = getArea(m.area?.id);
                        if (!a) return null;
                        return (
                          <span key={i} className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: a.color }}>
                            {a.icon} {a.name}
                          </span>
                        );
                      })}
                      {u.orgMemberships.length > 3 && (
                        <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                          +{u.orgMemberships.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── OverviewCard ───────────────────────────────────────────────────────────────

function OverviewCard({ area, onClick }: { area: OrgArea; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl p-5 flex-1 min-w-[160px] shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
      <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg" style={{ background: `${area.color}18` }}>
        {area.icon}
      </div>
      <div className="text-[13px] font-bold mb-1" style={{ color: area.color }}>{area.name}</div>
      <div className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-3">{area.desc}</div>
      <div className="mt-3 text-[11px] font-semibold flex items-center gap-1" style={{ color: area.color }}>
        Ver organigrama
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </button>
  );
}

// ── AreaTab ────────────────────────────────────────────────────────────────────

function AreaTab({ area, active, onClick }: { area: OrgArea; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
        active ? 'text-white' : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}
      style={active ? { borderBottomColor: area.color } : {}}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: area.color }} />
      {area.name}
    </button>
  );
}

// ── AreaPage ───────────────────────────────────────────────────────────────────

interface AreaPageProps {
  slug:            string;
  canEdit:         boolean;
  onSelectUser:    (m: OrgMembership) => void;
  onSelectTeam:    (t: OrgTeam) => void;
  editingArea:     boolean;
  onToggleEdit:    () => void;
  onRegisterSave:  (fn: () => void) => void;
}

function AreaPage({ slug, canEdit, onSelectUser, onSelectTeam, editingArea, onToggleEdit, onRegisterSave }: AreaPageProps) {
  const { data, isLoading, error } = useOrgAreaTree(slug);
  const updateArea  = useUpdateOrgArea();
  const areaNameRef = useRef<HTMLSpanElement>(null);
  const areaDescRef = useRef<HTMLParagraphElement>(null);

  const isEditing = canEdit && editingArea;

  function handleSaveArea() {
    if (!data) return;
    const name = areaNameRef.current?.textContent?.trim() || undefined;
    const desc = areaDescRef.current?.textContent?.trim() || undefined;
    updateArea.mutate(
      { id: data.id, data: { name, desc } },
      { onSuccess: onToggleEdit },
    );
  }

  useEffect(() => {
    onRegisterSave(handleSaveArea);
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  }
  if (error || !data) return <p className="text-red-500 text-sm p-4">Error cargando el organigrama.</p>;

  const totalMembers = new Set(data.teams.flatMap((t) => t.memberships.map((m) => m.userId))).size;

  return (
    <div>
      <div className="text-center py-6 px-5 flex flex-col items-center gap-3">
        <span
          ref={areaNameRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          className={`px-6 py-2.5 rounded-full text-lg font-bold tracking-widest uppercase text-white ${isEditing ? 'cursor-text focus:outline-none focus:ring-2 focus:ring-white/40 min-w-[80px]' : ''}`}
          style={{ background: data.color }}
        >
          {data.name}
        </span>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-slate-500 border border-slate-200 bg-slate-50">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {totalMembers} personas · {data.teams.length} equipos
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-3">
            {[
              { label: 'Líder de Área',  cls: 'bg-white border-l-2', style: { borderLeftColor: data.color } },
              { label: 'Equipo',         cls: 'bg-slate-800',        style: {} },
              { label: 'Líder / Miembro', cls: 'bg-white',           style: { border: `1.5px solid ${data.color}50` } },
            ].map(({ label, cls, style }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className={`w-6 h-4 rounded inline-block border ${cls}`} style={style} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {(data.desc || isEditing) && (
          <p
            ref={areaDescRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            className={`text-[12.5px] max-w-2xl text-center leading-relaxed ${
              isEditing
                ? 'cursor-text focus:outline-none rounded-lg px-3 py-1.5 focus:bg-slate-100 text-slate-600 border border-dashed border-slate-200'
                : 'text-slate-500'
            } ${!data.desc && isEditing ? 'text-slate-300 italic' : ''}`}
          >
            {data.desc ?? (isEditing ? 'Agregar descripción del área...' : '')}
          </p>
        )}

        {isEditing && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg mt-1">
            Haz clic en nombre o descripción del área para editar el texto
          </p>
        )}
      </div>

      <div className="px-5 pb-10">
        <TreeView data={data} canEdit={isEditing} onSelectUser={onSelectUser} onSelectTeam={onSelectTeam} />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type SelectedItem =
  | { kind: 'membership'; data: OrgMembership; color: string }
  | { kind: 'team';       data: OrgTeam;       color: string };

export function OrgChartClient() {
  const { data: areas, isLoading: areasLoading } = useOrgAreas();
  const user    = useAuthStore((s) => s.user);
  const canEdit = user?.role?.name?.toLowerCase() === 'admin';

  const [activeSlug,      setActiveSlug]      = useState<string | null>(null);
  const [selected,        setSelected]        = useState<SelectedItem | null>(null);
  const [searchSelected,  setSearchSelected]  = useState<OrgSearchUser | null>(null);
  const [editingArea,     setEditingArea]     = useState(false);
  const areaSaveFnRef = useRef<(() => void) | null>(null);

  function getColor(areaId?: number) {
    return areas?.find((a) => a.id === areaId)?.color ?? '#64748b';
  }

  function handleSelectUser(m: OrgMembership, color: string) {
    setSelected({ kind: 'membership', data: m, color });
  }

  function handleSelectTeam(t: OrgTeam, color: string) {
    setSelected({ kind: 'team', data: t, color });
  }

  if (areasLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  const activeArea   = areas?.find((a) => a.slug === activeSlug);
  const activeColor  = activeArea?.color ?? '#64748b';

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Tabs */}
      <div className="bg-slate-900 px-5 flex items-center gap-0.5 overflow-x-auto scrollbar-none border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => { setActiveSlug(null); setSelected(null); setEditingArea(false); }}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${activeSlug === null ? 'text-white border-white/60' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          Vista General
        </button>
        {areas?.map((area) => (
          <AreaTab key={area.slug} area={area} active={activeSlug === area.slug} onClick={() => { setActiveSlug(area.slug); setSelected(null); setEditingArea(false); }} />
        ))}

        {/* Botón editar — solo visible en un área específica */}
        {canEdit && activeSlug !== null && (
          <div className="ml-auto pl-4 flex-shrink-0">
            {!editingArea ? (
              <button
                onClick={() => setEditingArea(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all"
                style={{ background: activeArea?.color ?? '#334155' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar área
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Modo edición activo
                </span>
                <button
                  onClick={() => areaSaveFnRef.current?.()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all"
                  style={{ background: activeArea?.color ?? '#334155' }}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Guardar
                </button>
                <button
                  onClick={() => setEditingArea(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {activeSlug === null ? (
          <div>
            {/* Hero con buscador */}
            <div className="bg-white border-b border-slate-100 px-6 pt-8 pb-7 flex flex-col items-center gap-3">
              <div className="text-center mb-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">ARM Global</p>
                <h1 className="text-2xl font-bold text-slate-900">Organigramas</h1>
              </div>
              <SearchBar areas={areas ?? []} onSelectUser={(u) => { setSearchSelected(u); setSelected(null); }} />
              <p className="text-[11.5px] text-slate-400">Busca por nombre o cargo en todos los organigramas</p>
            </div>
            <div className="px-6 pt-6 pb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {areas?.map((area) => (
                <OverviewCard key={area.slug} area={area} onClick={() => setActiveSlug(area.slug)} />
              ))}
            </div>
          </div>
        ) : (
          <AreaPage
            slug={activeSlug}
            canEdit={canEdit}
            onSelectUser={(m) => handleSelectUser(m, activeColor)}
            onSelectTeam={(t) => handleSelectTeam(t, activeColor)}
            editingArea={editingArea}
            onToggleEdit={() => setEditingArea((v) => !v)}
            onRegisterSave={(fn) => { areaSaveFnRef.current = fn; }}
          />
        )}
      </div>

      {/* Panel lateral */}
      {searchSelected && (
        <SearchUserDetailPanel
          key={searchSelected.id}
          user={searchSelected}
          areas={areas ?? []}
          onClose={() => setSearchSelected(null)}
        />
      )}
      {!searchSelected && selected?.kind === 'membership' && (
        <UserDetailPanel
          key={selected.data.id}
          membership={selected.data}
          color={selected.color}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
      {!searchSelected && selected?.kind === 'team' && (
        <TeamDetailPanel
          key={selected.data.id}
          team={selected.data}
          color={selected.color}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
