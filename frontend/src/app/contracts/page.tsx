'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { hasSession } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { SemaphoreBadge } from '@/components/SemaphoreBadge';
import type { Contract, ContractDashboard } from '@/types/api';

interface ContractCard {
  contract: Contract;
  dashboard: ContractDashboard;
}

export default function ContractsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<ContractCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
      return;
    }
    loadContracts();
  }, [router]);

  async function loadContracts() {
    setLoading(true);
    try {
      const { data: contracts } = await apiClient.get<Contract[]>('/contracts');
      const cardsData = await Promise.all(
        contracts.map(async (contract) => {
          const { data: dashboard } = await apiClient.get<ContractDashboard>(`/contracts/${contract.id}/dashboard`);
          return { contract, dashboard };
        }),
      );
      setCards(cardsData);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mis contratos</h1>
          <p className="text-sm text-gray-500">Contratos asignados para ejecución y seguimiento.</p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando contratos...</p>}

      {!loading && cards.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          No tienes contratos asignados todavía.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ contract, dashboard }) => (
          <div key={contract.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Contrato</p>
                <h2 className="text-lg font-bold text-institucional">{contract.contractNumber}</h2>
              </div>
              <SemaphoreBadge value={dashboard.execution.semaphore} />
            </div>

            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{contract.purpose}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Ejecución física" value={`${dashboard.execution.physicalPercentage}%`} />
              <Metric label="Ejecución financiera" value={`${dashboard.execution.financialPercentage}%`} />
              <Metric
                label="Actividades"
                value={`${dashboard.activities.ejecutadas} / ${dashboard.activities.total}`}
              />
              <Metric label="Pendientes" value={String(dashboard.activities.pendientes + dashboard.activities.enProceso)} />
              <Metric label="Evidencias" value={String(dashboard.evidenceCount)} />
              <Metric label="Alertas" value={String(dashboard.unresolvedAlerts)} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/contracts/${contract.id}`}
                className="rounded-md bg-institucional px-3 py-1.5 text-xs font-semibold text-white hover:bg-institucional-dark"
              >
                Ver contrato
              </Link>
              <Link
                href={`/contracts/${contract.id}/reports`}
                className="rounded-md border border-institucional px-3 py-1.5 text-xs font-semibold text-institucional hover:bg-institucional/5"
              >
                Ver informes
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}
