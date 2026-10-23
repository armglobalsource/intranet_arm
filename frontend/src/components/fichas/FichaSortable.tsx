'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { moveFichaBlock, type FichaColumns } from '@/lib/ficha-order';

const RowSorting = createContext(false);

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

const accessibility = {
  screenReaderInstructions: { draggable: 'Pulsa espacio para tomar el elemento, las flechas para moverlo y espacio para soltarlo. Escape cancela.' },
  announcements: {
    onDragStart: () => 'Elemento tomado. Usa las flechas para moverlo.',
    onDragOver: () => 'Nueva posición seleccionada.',
    onDragEnd: () => 'Elemento soltado.',
    onDragCancel: () => 'Movimiento cancelado.',
  },
};

export function SortableSection({ items = [], onReorder, children }: {
  items?: { id: string; label?: string }[];
  onReorder?: (activeId: string, overId: string) => void;
  children: ReactNode;
}) {
  const sensors = useDragSensors();
  if (!onReorder) return <RowSorting.Provider value={false}>{children}</RowSorting.Provider>;
  return (
    <RowSorting.Provider value>
      <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={accessibility}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
        }}>
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>{children}</SortableContext>
      </DndContext>
    </RowSorting.Provider>
  );
}

export function SortableRow({ id, editable, children }: {
  id: string; editable?: boolean; children: (handle: ReactNode) => ReactNode;
}) {
  const enabled = useContext(RowSorting) && editable;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  if (!enabled) return <>{children(null)}</>;
  return (
    <div ref={setNodeRef} className="ficha-sortable-row" data-row-id={id}
      style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.65 : 1, minWidth: 0 }}>
      {children(<button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
        className="ficha-drag-handle ficha-no-print" aria-label="Mover fila" title="Arrastrar para ordenar la fila">
        <GripVertical size={15} aria-hidden="true" />
      </button>)}
    </div>
  );
}

function Block({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  return <div ref={setNodeRef} className={`ficha-sortable-block${isOver ? ' is-over' : ''}`} data-block-id={id}
    style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.6 : 1 }}>
    <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
      className="ficha-block-handle ficha-no-print" aria-label={`Mover bloque ${label}`} title="Arrastrar bloque a otra posición o columna">
      <GripVertical size={15} aria-hidden="true" /><span>Mover bloque</span>
    </button>
    {children}
  </div>;
}

function Column({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${side}` });
  return <div ref={setNodeRef} className={`ficha-drop-column${isOver ? ' is-over' : ''}`}>
    {children}
    <div className="ficha-drop-end ficha-no-print">Soltar bloque aquí</div>
  </div>;
}

export function SortableFichaLayout({ layout, visible, onChange, renderSlot, label }: {
  layout: FichaColumns; visible: { left: string[]; right: string[] };
  onChange?: (layout: FichaColumns) => void;
  renderSlot: (id: string) => ReactNode; label: (id: string) => string;
}) {
  const sensors = useDragSensors();
  const grid = (sortable: boolean) => <div className="ficha-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
    {(['left', 'right'] as const).map((side) => sortable ? (
      <Column key={side} side={side}>
        <SortableContext items={visible[side]} strategy={rectSortingStrategy}>
          {visible[side].map((id) => <Block key={id} id={id} label={label(id)}>{renderSlot(id)}</Block>)}
        </SortableContext>
      </Column>
    ) : <div key={side} style={{ minWidth: 0 }}>{visible[side].map((id) => <div key={id}>{renderSlot(id)}</div>)}</div>)}
  </div>;
  if (!onChange) return grid(false);
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const next = moveFichaBlock(layout, String(active.id), String(over.id));
    if (next !== layout) onChange?.(next);
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={accessibility}>
    {grid(true)}
  </DndContext>;
}
