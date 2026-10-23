'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useRef, useState } from 'react';

const TEAL = '#0D9488';

interface RichTextEditorProps {
  value:     string;
  editable:  boolean;
  onChange?: (html: string) => void;
  placeholder?: string;
}

/**
 * Editor de rich text tipo Word/Notion basado en TipTap. Guarda HTML.
 *
 * En modo Editar: barra de herramientas visible arriba con negrita,
 * cursiva, subrayado, títulos H2/H3, listas, cita, link, undo/redo.
 * En modo Vista: solo el HTML renderizado sin controles ni bordes.
 *
 * El onChange se dispara en cada edición — el caller debe hacer debounce
 * antes de persistir al backend.
 */
export function RichTextEditor({ value, editable, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Deshabilitar horizontal rule (no lo necesitamos, se hace con divider CSS)
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'ficha-rich-link',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: 'ficha-rich-content',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // TipTap devuelve "<p></p>" cuando está vacío; normalizamos a "".
      onChange?.(html === '<p></p>' ? '' : html);
    },
    // Requerido en Next.js SSR para evitar hydration mismatch.
    immediatelyRender: false,
  });

  // Sincronizar contenido cuando cambia desde afuera (ej. otro editor)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '<p></p>';
    if (current !== incoming) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Actualizar editable dinámicamente
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return (
      <div style={{
        padding: 12, minHeight: 120,
        border: '1px dashed var(--song-border, #64748b)', borderRadius: 8,
        color: 'var(--song-muted, #94a3b8)', fontSize: 12,
      }}>
        Cargando editor…
      </div>
    );
  }

  const isEmpty = !editor.getText().trim();

  return (
    <div style={{ minWidth: 0 }}>
      {editable && <Toolbar editor={editor} />}
      <div style={{
        position: 'relative',
        background: editable ? 'var(--song-surface, rgba(255,255,255,0.03))' : 'transparent',
        border: editable ? '1px solid var(--song-border, rgba(255,255,255,0.12))' : 'none',
        borderRadius: 8,
        padding: editable ? '10px 14px' : 0,
        minHeight: editable ? 220 : 0,
      }}>
        <EditorContent editor={editor} />
        {editable && isEmpty && placeholder && (
          <div style={{
            position: 'absolute', top: 12, left: 16,
            fontSize: 12, color: 'var(--song-muted, #94a3b8)',
            pointerEvents: 'none', userSelect: 'none',
          }}>
            {placeholder}
          </div>
        )}
      </div>

      {/* Estilos del contenido — se aplican tanto en editor como en vista */}
      <style>{`
        .ficha-rich-content {
          outline: none;
          font-size: 13px;
          line-height: 1.55;
          color: var(--song-primary, #f0efec);
          min-height: 60px;
        }
        .ficha-rich-content p { margin: 0 0 8px 0; }
        .ficha-rich-content p:last-child { margin-bottom: 0; }
        .ficha-rich-content strong { color: var(--song-primary, #ffffff); font-weight: 700; }
        .ficha-rich-content em { font-style: italic; }
        .ficha-rich-content u { text-decoration: underline; }
        .ficha-rich-content h2 {
          font-size: 15px; font-weight: 700; color: var(--song-primary, #ffffff);
          margin: 14px 0 6px 0; letter-spacing: -0.005em;
        }
        .ficha-rich-content h3 {
          font-size: 13px; font-weight: 700; color: ${TEAL};
          margin: 12px 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .ficha-rich-content ul, .ficha-rich-content ol {
          margin: 6px 0 8px 0; padding-left: 20px;
        }
        .ficha-rich-content ul li { list-style: disc; margin: 2px 0; }
        .ficha-rich-content ol li { list-style: decimal; margin: 2px 0; }
        .ficha-rich-content blockquote {
          margin: 8px 0; padding: 8px 12px;
          border-left: 3px solid ${TEAL};
          background: rgba(13,148,136,0.06);
          border-radius: 0 6px 6px 0;
          font-style: italic; color: var(--song-secondary, rgba(255,255,255,0.8));
        }
        .ficha-rich-link {
          color: ${TEAL}; text-decoration: underline;
          text-decoration-color: rgba(13,148,136,0.5);
        }
        .ficha-rich-content code {
          background: rgba(255,255,255,0.08); border-radius: 3px;
          padding: 1px 5px; font-size: 12px; font-family: 'SF Mono', ui-monospace, monospace;
        }

        /* En print: fondo blanco, texto oscuro */
        @media print {
          .ficha-rich-content {
            color: #111 !important;
            font-size: 11px !important;
          }
          .ficha-rich-content strong { color: #000 !important; }
          .ficha-rich-content h2, .ficha-rich-content h3 { color: #000 !important; }
          .ficha-rich-content blockquote {
            background: #f2f2f2 !important;
            border-left-color: #666 !important;
            color: #333 !important;
          }
          .ficha-rich-link { color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl]   = useState('');
  const linkInputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkOpen) setTimeout(() => linkInputRef.current?.focus(), 30);
  }, [linkOpen]);

  function openLinkDialog() {
    const prev = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(prev ?? '');
    setLinkOpen(true);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: withProtocol }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="ficha-no-print" style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
      padding: '6px 8px', marginBottom: 6,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid var(--song-border, rgba(255,255,255,0.1))',
      borderRadius: 8,
    }}>
      <TBtn label="Deshacer" active={false} onClick={() => editor.chain().focus().undo().run()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </TBtn>
      <TBtn label="Rehacer" active={false} onClick={() => editor.chain().focus().redo().run()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </TBtn>
      <Sep />

      <TBtn label="Título grande (H2)" active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>H2</span>
      </TBtn>
      <TBtn label="Título chico (H3)" active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>H3</span>
      </TBtn>
      <Sep />

      <TBtn label="Negrita (Cmd+B)" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>B</span>
      </TBtn>
      <TBtn label="Cursiva (Cmd+I)" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span style={{ fontSize: 12, fontStyle: 'italic' }}>I</span>
      </TBtn>
      <TBtn label="Subrayado (Cmd+U)" active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span style={{ fontSize: 12, textDecoration: 'underline' }}>U</span>
      </TBtn>
      <TBtn label="Tachado" active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span style={{ fontSize: 12, textDecoration: 'line-through' }}>S</span>
      </TBtn>
      <Sep />

      <TBtn label="Lista con viñetas" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </TBtn>
      <TBtn label="Lista numerada" active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </svg>
      </TBtn>
      <TBtn label="Cita" active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h1c0 3-1 4-3 4-.5 0-1 .5-1 1v2c0 .5.5 1 1 1zM17 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h1c0 3-1 4-3 4-.5 0-1 .5-1 1v2c0 .5.5 1 1 1z" />
        </svg>
      </TBtn>
      <Sep />

      <div style={{ position: 'relative' }}>
        <TBtn label="Insertar link" active={editor.isActive('link')} onClick={openLinkDialog}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </TBtn>
        {linkOpen && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 10,
            background: 'var(--song-surface, #1a1a1a)', border: '1px solid var(--song-border, rgba(255,255,255,0.15))',
            borderRadius: 8, padding: 8, display: 'flex', gap: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 280,
          }}>
            <input
              ref={linkInputRef}
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink();
                if (e.key === 'Escape') setLinkOpen(false);
              }}
              placeholder="https://…"
              style={{
                flex: 1, padding: '4px 8px', fontSize: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 5, color: 'var(--song-primary, #f0efec)', outline: 'none',
              }}
            />
            <button onClick={applyLink} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: TEAL, color: '#fff', border: 'none',
              borderRadius: 5, cursor: 'pointer',
            }}>OK</button>
            <button onClick={() => setLinkOpen(false)} style={{
              padding: '4px 8px', fontSize: 11,
              background: 'rgba(255,255,255,0.06)', color: '#888',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 5, cursor: 'pointer',
            }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TBtn({ label, active, onClick, children }: {
  label: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 28, height: 28, borderRadius: 5,
        border: 'none',
        background: active ? 'rgba(13,148,136,0.22)' : 'transparent',
        color: active ? TEAL : 'var(--song-secondary, rgba(240,239,236,0.75))',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'rgba(13,148,136,0.30)' : 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'rgba(13,148,136,0.22)' : 'transparent'; }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />;
}
