'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ContractDashboard } from '@/types/api';

export function SCurveChart({ points }: { points: ContractDashboard['sCurve'] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        Aún no hay periodos de ejecución cerrados para graficar la curva S.
      </div>
    );
  }

  const data = points.map((p) => ({
    periodo: p.periodLabel,
    Programado: Number(p.plannedPercentage),
    Ejecutado: Number(p.executedPercentage),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip formatter={(value: number) => `${value}%`} />
        <Legend />
        <Line type="monotone" dataKey="Programado" stroke="#3E63B0" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Ejecutado" stroke="#1E8E3E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
