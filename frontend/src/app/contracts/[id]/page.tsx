'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { hasSession } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { SemaphoreBadge } from '@/components/SemaphoreBadge';
import { SCurveChart } from '@/components/SCurveChart';
import type { Alert, ContractDashboard, Obligation } from '@/types/api';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<ContractDashboard | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    setLoading(true);
    try {
      const [dashboardRes, obligationsRes, alertsRes] = await Promise.all([
        apiClient.get<ContractDashboard>(`/contracts/${params.id}/dashboard`),
        apiClient.get<Obligation[]>(`/contracts/${params.id}/obligations`),
        apiClient.get<Alert[]>(`/contracts/${params.id}/alerts`),
      ]);
      setDashboard(dashboardRes.data);
      setObligations(obligationsRes.data);
      setAlerts(alertsRes.data);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !dashboard) {
    return (
      <AppShell>
        <p className="text-sm text-gray-500">Cargando contrato...</p>
      </AppShell>
    );
  }

  const { contract, execution } = dashboard;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Contrato</p>
          <h1 className="text-2xl font-bold text-institucional">{contract.contractNumber}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{contract.purpose}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SemaphoreBadge value={execution.semaphore} />
          <div className="flex gap-2">
            <Link
              href={`/contracts/${contract.id}/payments`}
              className="rounded-md border border-institucional px-3 py-1.5 text-xs font-semibold text-institucional hover:bg-institucional/5"
            >
              Ver pagos
            </Link>
            <Link
              href={`/contracts/${contract.id}/reports`}
              className="rounded-md border border-institucional px-3 py-1.5 text-xs font-semibold text-institucional hover:bg-institucional/5"
            >
              Generar informes
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6 mb-6">
        <StatCard label="Ejecución física" value={`${execution.physicalPercentage}%`} />
        <StatCard label="Ejecución financiera" value={`${execution.financialPercentage}%`} />
        <StatCard label="Ejecución temporal" value={`${execution.temporalPercentage}%`} />
        <StatCard label="Desviación" value={`${execution.deviation}%`} highlight={execution.semaphore} />
        <StatCard label="Valor actual" value={currencyFormatter.format(Number(contract.currentValue))} small />
        <StatCard label="Saldo" value={currencyFormatter.format(Number(execution.balance))} small />
        <StatCard label="Pagos pendientes" value={String(dashboard.paymentsPending)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Curva S — Programado vs. Ejecutado</h2>
            <SCurveChart points={dashboard.sCurve} />
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Obligaciones y actividades</h2>
            <div className="space-y-4">
              {obligations.map((obligation) => (
                <div key={obligation.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-institucional">
                      {obligation.code} · {obligation.description}
                    </p>
                    <span className="text-xs text-gray-400">Peso {obligation.weightPercentage}%</span>
                  </div>
                  <ul className="mt-3 divide-y divide-gray-100">
                    {obligation.activities.map((activity) => (
                      <li key={activity.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">
                            {activity.code} — {activity.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Meta: {activity.plannedQuantity} {activity.unitOfMeasure}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusPill status={activity.status} />
                          <Link
                            href={`/contracts/${contract.id}/activities/${activity.id}`}
                            className="text-xs font-semibold text-institucional hover:underline"
                          >
                            Registrar ejecución
                          </Link>
                        </div>
                      </li>
                    ))}
                    {obligation.activities.length === 0 && (
                      <li className="py-2 text-sm text-gray-400">Sin actividades registradas.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Alertas</h2>
            {alerts.length === 0 && <p className="text-sm text-gray-400">Sin alertas activas.</p>}
            <ul className="space-y-2">
              {alerts
                .filter((a) => !a.isResolved)
                .map((alert) => (
                  <li key={alert.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {alert.message}
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 text-sm text-gray-600">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Plazo</h2>
            <p>
              {execution.elapsedDays} de {execution.totalDays} días transcurridos
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Inicio {contract.startDate.slice(0, 10)} — Fin {contract.endDate.slice(0, 10)}
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  small,
  highlight,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: 'GREEN' | 'YELLOW' | 'RED';
}) {
  const color = highlight === 'RED' ? 'text-estado-rojo' : highlight === 'YELLOW' ? 'text-estado-amarillo' : 'text-gray-800';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 font-bold ${small ? 'text-sm' : 'text-xl'} ${color}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDIENTE: 'bg-gray-100 text-gray-600',
    EN_PROCESO: 'bg-blue-100 text-blue-700',
    EJECUTADA: 'bg-green-100 text-green-700',
    SUBMITTED: 'bg-purple-100 text-purple-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    NEEDS_CORRECTION: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
