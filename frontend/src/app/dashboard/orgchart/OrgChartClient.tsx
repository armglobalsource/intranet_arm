'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  useOrgAreas,
  useOrgAreaTree,
  useOrgSearch,
  useUpdateOrgNode,
  useUpdateOrgArea,
  useCreateOrgNode,
  useDeleteOrgNode,
  useLinkOrgUser,
} from '@/hooks/useOrgChart';
import type { OrgArea, OrgAreaTree, OrgNode, OrgLinkedUser, OrgSearchResult, OrgNodeType } from '@/types/orgchart';

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  const line  = name.split('\n')[0];
  const words = line.split(/\s+/).filter((w) => w.length > 2 && !/^(Pra|Pri|Pas|Pr\.)$/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return line.slice(0, 2).toUpperCase();
}

function userInitials(u: OrgLinkedUser) {
  return (u.firstName[0] + u.lastName[0]).toUpperCase();
}

function countPeople(nodes: OrgNode[]): number {
  const SKIP = ['voluntarios', 'encargado', 'encargada', 'sin asignar', 'vacante', 'por confirmar', 'rotatorio'];
  let n = 0;
  for (const nd of nodes) {
    if (nd.type !== 'group') {
      const low = nd.name.toLowerCase();
      if (!SKIP.some((s) => low.includes(s))) n += nd.name.split('\n').length;
    }
    if (nd.children?.length) n += countPeople(nd.children);
  }
  return n;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  node:  OrgNode;
  color: string;
  size?: number;
}

function Avatar({ node, color, size = 38 }: AvatarProps) {
  const u  = node.user;
  const sz = `${size}px`;

  if (u?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={u.avatarUrl}
        alt={`${u.firstName} ${u.lastName}`}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: sz, height: sz }}
      />
    );
  }

  const avStyle =
    node.type === 'leader'
      ? { background: color, color: 'white' }
      : node.type === 'group'
      ? { background: 'rgba(255,255,255,0.12)', color: 'white' }
      : { background: `${color}20`, color };

  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
      style={{ width: sz, height: sz, ...avStyle }}
    >
      {node.type === 'group'
        ? (node.icon ?? '👥')
        : u
        ? userInitials(u)
        : initials(node.name)}
    </div>
  );
}

// ── LinkUserModal ─────────────────────────────────────────────────────────────

interface LinkUserModalProps {
  node:    OrgNode;
  color:   string;
  onClose: () => void;
}

function LinkUserModal({ node, color, onClose }: LinkUserModalProps) {
  const [query,     setQuery]     = useState('');
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState<OrgLinkedUser[]>([]);
  const linkUser = useLinkOrgUser();

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const ctrl = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/users?search=${encodeURIComponent(query)}&limit=10`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((d) => setResults(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [query]);

  function handleLink(userId: number) {
    linkUser.mutate({ nodeId: node.id, userId }, { onSuccess: onClose });
  }

  function handleUnlink() {
    linkUser.mutate({ nodeId: node.id, userId: null }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[min(420px,92vw)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-900">Vincular usuario</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{node.name.split('\n')[0]}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        {node.user && (
          <div className="mx-5 mt-4 flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
            <Avatar node={node} color={color} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{node.user.firstName} {node.user.lastName}</p>
              <p className="text-xs text-slate-500 truncate">{node.user.email}</p>
            </div>
            <button
              onClick={handleUnlink}
              disabled={linkUser.isPending}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
            >
              Desvincular
            </button>
          </div>
        )}

        <div className="p-5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <div className="mt-3 flex flex-col gap-1 max-h-52 overflow-y-auto">
            {searching && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
            )}
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => handleLink(u.id)}
                disabled={linkUser.isPending}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors border border-transparent hover:border-slate-200"
              >
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: color }}
                >
                  {(u.firstName[0] + u.lastName[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-slate-500 truncate">{u.jobTitle ?? u.email}</p>
                </div>
                {node.userId === u.id && (
                  <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">Vinculado</span>
                )}
              </button>
            ))}
            {!searching && query.length < 2 && (
              <p className="text-xs text-slate-400 text-center py-3">Escribe al menos 2 caracteres para buscar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AddNodeModal ──────────────────────────────────────────────────────────────

interface AddNodeModalProps {
  parentNode: OrgNode;
  color:      string;
  onClose:    () => void;
}

function AddNodeModal({ parentNode, color, onClose }: AddNodeModalProps) {
  const [name,      setName]      = useState('');
  const [role,      setRole]      = useState('');
  const [type,      setType]      = useState<OrgNodeType>('person');
  // User linking inline
  const [userQuery,    setUserQuery]    = useState('');
  const [userResults,  setUserResults]  = useState<OrgLinkedUser[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [linkedUser,   setLinkedUser]   = useState<OrgLinkedUser | null>(null);
  const [showUserDrop, setShowUserDrop] = useState(false);

  const createNode = useCreateOrgNode();

  // Búsqueda de usuario con debounce
  useEffect(() => {
    if (type === 'group' || userQuery.trim().length < 2) {
      setUserResults([]);
      setShowUserDrop(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const tid = setTimeout(() => {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/users?search=${encodeURIComponent(userQuery)}&limit=8`,
        { signal: ctrl.signal },
      )
        .then((r) => r.json())
        .then((d) => {
          setUserResults(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
          setShowUserDrop(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => { clearTimeout(tid); ctrl.abort(); };
  }, [userQuery, type]);

  function selectUser(u: OrgLinkedUser) {
    setLinkedUser(u);
    setUserQuery(`${u.firstName} ${u.lastName}`);
    setShowUserDrop(false);
    // auto-rellenar nombre y rol si están vacíos
    if (!name.trim()) setName(`${u.firstName} ${u.lastName}`);
    if (!role.trim() && u.jobTitle) setRole(u.jobTitle);
  }

  function clearUser() {
    setLinkedUser(null);
    setUserQuery('');
    setUserResults([]);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    createNode.mutate(
      {
        areaId:   parentNode.areaId,
        parentId: parentNode.id,
        userId:   linkedUser?.id,
        type,
        name:     name.trim(),
        role:     role.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  }

  const NODE_TYPES: { value: OrgNodeType; label: string }[] = [
    { value: 'person', label: 'Persona' },
    { value: 'group',  label: 'Equipo'  },
    { value: 'leader', label: 'Líder'   },
  ];

  const showUserSearch = type !== 'group';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[min(420px,92vw)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-bold text-slate-900">Agregar nodo</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">
              Bajo: {parentNode.name.split('\n')[0]}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de nodo</label>
            <div className="flex gap-2">
              {NODE_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setType(value); clearUser(); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={
                    type === value
                      ? { background: color, color: '#fff', borderColor: color }
                      : { borderColor: '#e2e8f0', color: '#64748b' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Vincular usuario del sistema (Persona / Líder) */}
          {showUserSearch && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Vincular con usuario del sistema
                <span className="text-slate-300 font-normal ml-1">— opcional</span>
              </label>

              {linkedUser ? (
                /* Usuario seleccionado */
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: color }}
                  >
                    {(linkedUser.firstName[0] + linkedUser.lastName[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {linkedUser.firstName} {linkedUser.lastName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{linkedUser.email}</p>
                  </div>
                  <button
                    onClick={clearUser}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 flex-shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                /* Buscador */
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar por nombre o email…"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  {showUserDrop && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                      {searching && (
                        <div className="flex justify-center py-3">
                          <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                      )}
                      {!searching && userResults.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-3">Sin resultados</p>
                      )}
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          onMouseDown={() => selectUser(u)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {(u.firstName[0] + u.lastName[0]).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.jobTitle ?? u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Nombre del nodo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Nombre del cargo / rol en el organigrama <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus={!showUserSearch}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={type === 'group' ? 'Ej: Equipo de producción' : 'Ej: Guitarrista principal'}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Etiqueta de rol</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ej: Músico, Coordinador, Líder de área..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || createNode.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: color }}
            >
              {createNode.isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Agregando...</>
                : <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {linkedUser ? 'Agregar y vincular' : 'Agregar nodo'}
                  </>
              }
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node:     OrgNode;
  color:    string;
  onSelect: (node: OrgNode) => void;
}

function NodeCard({ node, color, onSelect }: NodeCardProps) {
  const [open,     setOpen]     = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasDesc     = !!node.description;
  const isLinked    = !!node.user;

  const cardBg =
    node.type === 'group'
      ? 'bg-slate-800 border-transparent'
      : node.type === 'leader'
      ? 'bg-white border-l-[3px]'
      : 'bg-white border-slate-200';

  const textColor = node.type === 'group' ? 'text-white' : 'text-slate-900';
  const subColor  = node.type === 'group' ? 'text-white/45' : 'text-slate-500';
  const borderStyle = node.type === 'leader' ? { borderLeftColor: color } : {};

  const displayName = node.user
    ? `${node.user.firstName} ${node.user.lastName}`
    : node.name;

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2.5 border rounded-[10px] px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md cursor-pointer group ${cardBg}`}
        style={borderStyle}
        onClick={() => onSelect(node)}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar node={node} color={color} size={38} />
          {isLinked && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center"
              style={{ background: color }}
              title={`Vinculado a ${node.user!.firstName} ${node.user!.lastName}`}
            >
              <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold leading-snug ${textColor} ${node.type === 'leader' ? 'text-sm font-bold' : ''}`}>
            {displayName}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`text-[10.5px] font-medium uppercase tracking-wide mt-0.5 ${subColor}`}>
              {node.role}
            </div>
            {node.user?.jobTitle && (
              <span className="text-[10px] text-slate-400 truncate hidden sm:block">· {node.user.jobTitle}</span>
            )}
          </div>
        </div>

        {/* Badge hijos */}
        {hasChildren && (
          <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0" style={{ background: `${color}18`, color }}>
            {node.children!.length}
          </span>
        )}

        {/* Botón descripción (read-only) */}
        {hasDesc && (
          <button
            onClick={(e) => { e.stopPropagation(); setDescOpen((v) => !v); }}
            className={`w-[22px] h-[22px] rounded-md flex-shrink-0 border flex items-center justify-center text-[11px] font-bold italic font-serif transition-all ${
              descOpen
                ? 'text-white border-transparent'
                : node.type === 'group'
                ? 'border-white/20 text-white/50 hover:bg-white/10'
                : 'border-slate-200 text-slate-400 hover:text-white hover:border-transparent'
            }`}
            style={descOpen ? { background: color, borderColor: color } : {}}
            title="Ver descripción"
          >
            i
          </button>
        )}

        {/* Toggle hijos */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className={`w-7 h-7 rounded-[7px] flex-shrink-0 border flex items-center justify-center transition-all ${
              open ? 'text-white border-transparent' : 'border-slate-200 text-slate-400 hover:text-white hover:border-transparent'
            }`}
            style={open ? { background: color, borderColor: color } : {}}
          >
            <svg
              className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {/* Panel descripción — read-only */}
      {hasDesc && descOpen && (
        <div
          className="text-[12.5px] leading-relaxed rounded-b-[9px] px-3.5 py-2.5 whitespace-pre-line border border-t-0 mt-[-2px] mb-1 text-slate-500"
          style={{ background: `${color}08`, borderColor: `${color}30` }}
        >
          {node.description}
        </div>
      )}

      {/* Nodos hijos */}
      {hasChildren && open && (
        <div
          className="ml-[18px] pl-[26px] mt-1.5 flex flex-col gap-1.5 pt-0.5 pb-0.5 border-l-2"
          style={{ borderColor: `${color}2a` }}
        >
          {node.children!.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              color={color}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── NodeDetailPanel ───────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node:    OrgNode;
  color:   string;
  canEdit: boolean;
  onClose: () => void;
}

function NodeDetailPanel({ node, color, canEdit, onClose }: NodeDetailPanelProps) {
  const [name,        setName]        = useState(node.user ? `${node.user.firstName} ${node.user.lastName}` : node.name);
  const [nodeName,    setNodeName]    = useState(node.name);
  const [role,        setRole]        = useState(node.role ?? '');
  const [description, setDescription] = useState(node.description ?? '');
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saving' | 'saved'>('idle');
  const [linkModal,   setLinkModal]   = useState(false);
  const [addModal,    setAddModal]    = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const updateNode   = useUpdateOrgNode();
  const deleteNode   = useDeleteOrgNode();
  const linkUser     = useLinkOrgUser();

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const typeLabelMap: Record<OrgNodeType, string> = {
    leader: 'Líder',
    person: 'Persona',
    group:  'Equipo',
  };

  function handleSave() {
    setSaveStatus('saving');
    updateNode.mutate(
      { id: node.id, data: { name: nodeName, role, description } },
      {
        onSuccess: () => {
          setSaveStatus('saved');
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
        },
        onError: () => setSaveStatus('idle'),
      },
    );
  }

  function handleDelete() {
    if (window.confirm(`¿Eliminar "${node.name.split('\n')[0]}"? Esta acción no se puede deshacer.`)) {
      deleteNode.mutate(node.id, { onSuccess: onClose });
    }
  }

  function handleUnlink() {
    linkUser.mutate({ nodeId: node.id, userId: null }, { onSuccess: onClose });
  }

  const displayName = node.user
    ? `${node.user.firstName} ${node.user.lastName}`
    : node.name;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        style={{ left: '224px' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col"
        style={{ width: '400px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0"
          style={{ borderTop: `3px solid ${color}` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
              style={{ background: color }}
            >
              {typeLabelMap[node.type]}
            </span>
            {saveStatus !== 'idle' && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                {saveStatus === 'saving' ? (
                  <>
                    <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Guardado
                  </span>
                )}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Avatar + nombre principal */}
          <div className="flex items-center gap-4">
            <Avatar node={node} color={color} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 leading-snug whitespace-pre-line">
                {displayName}
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-1">
                {node.role || <span className="italic text-slate-300 normal-case">Sin cargo</span>}
              </div>
            </div>
          </div>

          {/* Usuario vinculado */}
          {node.user && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Persona vinculada</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Cabecera con avatar */}
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 border-b border-slate-100">
                  {node.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={node.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: color }}
                    >
                      {userInitials(node.user)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{node.user.firstName} {node.user.lastName}</p>
                    {node.user.jobTitle && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">{node.user.jobTitle}</p>
                    )}
                  </div>
                </div>
                {/* Info de contacto */}
                <div className="flex flex-col divide-y divide-slate-100">
                  <a
                    href={`mailto:${node.user.email}`}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <span className="text-[12px] text-slate-600 truncate group-hover:text-blue-600 transition-colors">
                      {node.user.email}
                    </span>
                  </a>
                  {node.user.phone && (
                    <a
                      href={`tel:${node.user.phone}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span className="text-[12px] text-slate-600 group-hover:text-blue-600 transition-colors">
                        {node.user.phone}
                      </span>
                    </a>
                  )}
                  {node.user.country && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <span className="text-[12px] text-slate-600">{node.user.country}</span>
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setLinkModal(true)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cambiar usuario
                  </button>
                  <button
                    onClick={handleUnlink}
                    disabled={linkUser.isPending}
                    className="py-1.5 px-3 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vincular usuario cuando no hay usuario */}
          {!node.user && canEdit && node.type !== 'group' && (
            <button
              onClick={() => setLinkModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              Vincular usuario del directorio
            </button>
          )}

          {/* Separador edición */}
          {canEdit && <div className="border-t border-slate-100" />}

          {/* Nombre del nodo (editable) — solo si no hay usuario vinculado */}
          {canEdit && !node.user && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Nombre del nodo
              </label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                placeholder="Nombre del nodo"
              />
            </div>
          )}

          {/* Cargo / Rol (editable) */}
          {canEdit && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Cargo / Rol
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                placeholder="Ej: Director, Coordinador..."
              />
            </div>
          )}

          {/* Descripción */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Descripción</p>
            {canEdit ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Descripción del rol o función..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-slate-400 resize-none transition-colors"
              />
            ) : (
              <p className="text-sm text-slate-500 leading-relaxed">
                {node.description || <span className="italic text-slate-300">Sin descripción</span>}
              </p>
            )}
          </div>

          {/* Sub-nodos */}
          {(node.children?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Sub-nodos ({node.children!.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {node.children!.slice(0, 6).map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs text-slate-700 truncate flex-1">
                      {child.user
                        ? `${child.user.firstName} ${child.user.lastName}`
                        : child.name.split('\n')[0]}
                    </span>
                    {child.role && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0 truncate max-w-[100px]">{child.role}</span>
                    )}
                  </div>
                ))}
                {node.children!.length > 6 && (
                  <p className="text-xs text-slate-400 text-center py-1">+{node.children!.length - 6} más</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — acciones admin */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5">
            <button
              onClick={handleSave}
              disabled={updateNode.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: color }}
            >
              {updateNode.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setAddModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar sub-nodo
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteNode.isPending}
                className="px-4 py-2 rounded-xl border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals (z-50, por encima del panel) */}
      {linkModal && (
        <LinkUserModal node={node} color={color} onClose={onClose} />
      )}
      {addModal && (
        <AddNodeModal parentNode={node} color={color} onClose={() => setAddModal(false)} />
      )}
    </>
  );
}

// ── TreeView ──────────────────────────────────────────────────────────────────

interface TreeViewProps {
  data:     OrgAreaTree;
  onSelect: (node: OrgNode) => void;
}

function TreeView({ data, onSelect }: TreeViewProps) {
  const leader = data.nodes[0];
  if (!leader) return <p className="text-slate-400 text-sm p-4">Sin datos</p>;

  const children = leader.children ?? [];
  const maxCol   = children.reduce((m, c) => Math.max(m, c.colPosition ?? 1), 1);
  const byCol: Record<number, OrgNode[]> = {};
  for (let c = 1; c <= maxCol; c++) byCol[c] = [];
  children.forEach((ch) => byCol[ch.colPosition ?? 1].push(ch));

  return (
    <div className="flex flex-col gap-2">
      {/* Nodo líder — clickable */}
      <div
        className="flex items-center gap-2.5 bg-white border-l-[3px] rounded-[10px] px-3 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        style={{ borderLeftColor: data.color }}
        onClick={() => onSelect(leader)}
      >
        <Avatar node={leader} color={data.color} size={38} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 leading-snug whitespace-pre-line">
            {leader.user ? `${leader.user.firstName} ${leader.user.lastName}` : leader.name}
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500 mt-0.5">{leader.role}</div>
        </div>
        {leader.user && (
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-slate-400">{leader.user.email}</span>
            {leader.user.phone && <span className="text-[10px] text-slate-400">{leader.user.phone}</span>}
          </div>
        )}
        {/* Indicador vinculado */}
        {leader.user && (
          <span
            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: data.color }}
          >
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      {/* Grid de columnas */}
      <div className={`flex flex-col ${maxCol > 1 ? 'lg:flex-row' : ''} gap-3 items-start`}>
        {Array.from({ length: maxCol }, (_, i) => i + 1).map((col) => (
          <div key={col} className="flex flex-col gap-2 flex-1 min-w-0">
            {byCol[col].map((ch) => (
              <NodeCard
                key={ch.id}
                node={ch}
                color={data.color}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AreaTab ───────────────────────────────────────────────────────────────────

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

// ── OverviewCard ──────────────────────────────────────────────────────────────

function OverviewCard({ area, onClick }: { area: OrgArea; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-5 flex-1 min-w-[160px] shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
    >
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

// ── SearchBar ─────────────────────────────────────────────────────────────────

function SearchBar({ onSelect }: { onSelect: (r: OrgSearchResult) => void }) {
  const [q, setQ]           = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const wrapRef             = useRef<HTMLDivElement>(null);
  const { data: results }   = useOrgSearch(q);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDdOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-[320px]">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setDdOpen(true); }}
          onFocus={() => q.length >= 2 && setDdOpen(true)}
          placeholder="Buscar persona en todos los organigramas…"
          className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
        />
        {q && (
          <button onClick={() => { setQ(''); setDdOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xs">
            ✕
          </button>
        )}
      </div>

      {ddOpen && q.length >= 2 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
          {!results?.length ? (
            <div className="px-4 py-3.5 text-sm text-slate-400 text-center">Sin resultados para &ldquo;{q}&rdquo;</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.id}-${r.area.id}`}
                onMouseDown={() => { onSelect(r); setDdOpen(false); setQ(r.name.split('\n')[0]); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
              >
                {r.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style={{ background: r.area.color }}>
                    {r.user ? userInitials(r.user) : initials(r.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {r.user ? `${r.user.firstName} ${r.user.lastName}` : r.name.split('\n')[0]}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{r.role}</div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: r.area.color }}>
                  {r.area.icon} {r.area.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── SearchResultCard ──────────────────────────────────────────────────────────

function SearchResultCard({ results, onClose }: { results: OrgSearchResult[]; onClose: () => void }) {
  if (!results.length) return null;
  const first   = results[0];
  const areaMap = new Map(results.map((r) => [r.area.id, r.area]));
  const areas   = Array.from(areaMap.values());

  const displayName = first.user
    ? `${first.user.firstName} ${first.user.lastName}`
    : first.name;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-3xl mx-auto mb-4">
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
        {first.user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-white" style={{ background: first.area.color }}>
            {first.user ? userInitials(first.user) : initials(first.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-slate-900 leading-snug">{displayName}</div>
          {first.user && (
            <div className="text-xs text-slate-400 mt-0.5">{first.user.email}{first.user.phone ? ` · ${first.user.phone}` : ''}</div>
          )}
          <div className="text-xs text-slate-500 mt-1">
            {results.length} aparición{results.length !== 1 ? 'es' : ''} · {areas.length} área{areas.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm flex-shrink-0">
          ✕
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Área', 'Cargo / Rol', 'Equipo / Grupo', 'Nivel'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold text-white" style={{ background: r.area.color }}>
                    {r.area.icon} {r.area.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{r.role ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.parent?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                    r.type === 'leader' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {r.type === 'leader' ? 'Líder' : 'Persona'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AreaPage ──────────────────────────────────────────────────────────────────

interface AreaPageProps {
  slug:     string;
  canEdit:  boolean;
  onSelect: (node: OrgNode) => void;
}

function AreaPage({ slug, canEdit, onSelect }: AreaPageProps) {
  const { data, isLoading, error } = useOrgAreaTree(slug);
  const updateArea  = useUpdateOrgArea();
  const areaNameRef = useRef<HTMLSpanElement>(null);
  const areaDescRef = useRef<HTMLParagraphElement>(null);

  function handleSaveArea() {
    if (!data) return;
    const name = areaNameRef.current?.textContent?.trim() || undefined;
    const desc = areaDescRef.current?.textContent?.trim() || undefined;
    updateArea.mutate({ id: data.id, data: { name, desc } });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) return <p className="text-red-500 text-sm p-4">Error cargando el organigrama.</p>;

  const total = countPeople(data.nodes);

  return (
    <div>
      <div className="text-center py-6 px-5 flex flex-col items-center gap-3">
        {/* Título del área */}
        <span
          ref={areaNameRef}
          contentEditable={canEdit}
          suppressContentEditableWarning
          onBlur={canEdit ? handleSaveArea : undefined}
          className={`px-6 py-2.5 rounded-full text-lg font-bold tracking-widest uppercase text-white ${
            canEdit ? 'cursor-text focus:outline-none focus:ring-2 focus:ring-white/40 min-w-[80px]' : ''
          }`}
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
            {total} personas
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-3">
            {[
              { label: 'Líder',   cls: 'bg-white border-l-2', style: { borderLeftColor: data.color } },
              { label: 'Equipo',  cls: 'bg-slate-800',        style: {} },
              { label: 'Persona', cls: '',                     style: { background: `${data.color}10`, border: `1.5px solid ${data.color}30` } },
            ].map(({ label, cls, style }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className={`w-6 h-4 rounded inline-block border ${cls}`} style={style} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Descripción del área */}
        {(data.desc || canEdit) && (
          <p
            ref={areaDescRef}
            contentEditable={canEdit}
            suppressContentEditableWarning
            onBlur={canEdit ? handleSaveArea : undefined}
            className={`text-[12.5px] max-w-2xl text-center leading-relaxed ${
              canEdit
                ? 'cursor-text focus:outline-none rounded-lg px-3 py-1.5 focus:bg-slate-100 text-slate-600 border border-dashed border-slate-200'
                : 'text-slate-500'
            } ${!data.desc && canEdit ? 'text-slate-300 italic' : ''}`}
          >
            {data.desc ?? (canEdit ? 'Agregar descripción del área...' : '')}
          </p>
        )}

        {canEdit && (
          <p className="text-[11px] text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
            Haz clic en cualquier nodo para ver detalles o editar
          </p>
        )}
      </div>

      <div className="px-5 pb-10 w-full">
        <TreeView data={data} onSelect={onSelect} />
      </div>
    </div>
  );
}

// ── Main OrgChartClient ───────────────────────────────────────────────────────

export function OrgChartClient() {
  const { data: areas, isLoading: areasLoading } = useOrgAreas();
  const user    = useAuthStore((s) => s.user);
  const canEdit = user?.role?.name?.toLowerCase() === 'admin';

  const [activeSlug,    setActiveSlug]    = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<OrgSearchResult[] | null>(null);
  const [selectedNode,  setSelectedNode]  = useState<OrgNode | null>(null);

  const selectedColor = selectedNode && areas
    ? (areas.find((a) => a.id === selectedNode.areaId)?.color ?? '#64748b')
    : '#64748b';

  function handleSelectNode(node: OrgNode) {
    setSelectedNode(node);
  }

  function handleClosePanel() {
    setSelectedNode(null);
  }

  if (areasLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">

      {/* Tabs */}
      <div className="bg-slate-900 px-5 flex items-center gap-0.5 overflow-x-auto scrollbar-none border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => { setActiveSlug(null); setSearchResults(null); setSelectedNode(null); }}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
            activeSlug === null ? 'text-white border-white/60' : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          Vista General
        </button>
        {areas?.map((area) => (
          <AreaTab
            key={area.slug}
            area={area}
            active={activeSlug === area.slug}
            onClick={() => { setActiveSlug(area.slug); setSearchResults(null); setSelectedNode(null); }}
          />
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {activeSlug === null ? (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">ARM Global</p>
                  <h1 className="text-xl font-bold text-slate-900">Áreas Creativas</h1>
                </div>
                <SearchBar onSelect={(r) => setSearchResults([r])} />
              </div>
              {searchResults && (
                <SearchResultCard results={searchResults} onClose={() => setSearchResults(null)} />
              )}
            </div>

            {/* Grid de áreas */}
            <div className="px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {areas?.map((area) => (
                <OverviewCard key={area.slug} area={area} onClick={() => setActiveSlug(area.slug)} />
              ))}
            </div>
          </div>
        ) : (
          <AreaPage
            slug={activeSlug}
            canEdit={canEdit}
            onSelect={handleSelectNode}
          />
        )}
      </div>

      {/* Panel lateral de detalle del nodo */}
      {selectedNode && (
        <NodeDetailPanel
          key={selectedNode.id}
          node={selectedNode}
          color={selectedColor}
          canEdit={canEdit}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
