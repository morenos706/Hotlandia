import type { Semaphore } from '@/types/api';

const LABELS: Record<Semaphore, string> = {
  GREEN: 'En cumplimiento',
  YELLOW: 'Desviación moderada',
  RED: 'Desviación crítica',
};

const CLASSES: Record<Semaphore, string> = {
  GREEN: 'badge-verde',
  YELLOW: 'badge-amarillo',
  RED: 'badge-rojo',
};

export function SemaphoreBadge({ value }: { value: Semaphore }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${CLASSES[value]}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {LABELS[value]}
    </span>
  );
}
