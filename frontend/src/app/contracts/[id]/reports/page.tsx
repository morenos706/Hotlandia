'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { hasSession } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';

export default function ContractReportsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
    }
  }, [router]);

  async function download(kind: 'pdf' | 'excel') {
    setDownloading(kind);
    setError(null);
    try {
      const response = await apiClient.get(`/contracts/${params.id}/reports/${kind}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = kind === 'pdf' ? `informe-${params.id}.pdf` : `contrato-${params.id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('No fue posible generar el archivo. Intenta nuevamente.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-bold text-institucional">Informes del contrato</h1>

      {error && <p className="mb-4 text-sm text-estado-rojo">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Informe de ejecución (PDF)</h2>
          <p className="mb-4 text-sm text-gray-500">
            Incluye información general, objeto, ejecución física/financiera/temporal, obligaciones,
            actividades, alertas y observaciones.
          </p>
          <button
            onClick={() => download('pdf')}
            disabled={downloading === 'pdf'}
            className="rounded-md bg-institucional px-4 py-2 text-sm font-semibold text-white hover:bg-institucional-dark disabled:opacity-60"
          >
            {downloading === 'pdf' ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Exportación a Excel</h2>
          <p className="mb-4 text-sm text-gray-500">
            Hojas: Contrato, Obligaciones, Actividades, Ejecución y Pagos, listas para análisis.
          </p>
          <button
            onClick={() => download('excel')}
            disabled={downloading === 'excel'}
            className="rounded-md bg-institucional px-4 py-2 text-sm font-semibold text-white hover:bg-institucional-dark disabled:opacity-60"
          >
            {downloading === 'excel' ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
