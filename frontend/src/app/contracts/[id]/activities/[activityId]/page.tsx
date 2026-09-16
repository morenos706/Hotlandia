'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { hasSession } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import type { Activity, ExecutionPeriod } from '@/types/api';

interface ExecutionRecordRow {
  id: string;
  executedQuantity: string;
  executedValue: string;
  physicalPercentage: string;
  executionDate: string;
  period: { label: string };
}

interface EvidenceRow {
  id: string;
  type: string;
  originalFileName: string;
  uploadedAt: string;
  description?: string | null;
}

const EVIDENCE_TYPES = ['FOTOGRAFIA', 'PDF', 'WORD', 'EXCEL', 'ACTA', 'CERTIFICADO', 'VIDEO', 'OTRO'];

export default function ActivityDetailPage() {
  const params = useParams<{ id: string; activityId: string }>();
  const router = useRouter();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [periods, setPeriods] = useState<ExecutionPeriod[]>([]);
  const [records, setRecords] = useState<ExecutionRecordRow[]>([]);
  const [evidences, setEvidences] = useState<EvidenceRow[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [executionForm, setExecutionForm] = useState({
    periodId: '',
    executedQuantity: '',
    executedValue: '',
    executionDate: '',
    result: '',
  });

  const [evidenceForm, setEvidenceForm] = useState({ type: 'FOTOGRAFIA', description: '' });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.activityId]);

  async function loadAll() {
    const [activityRes, periodsRes, recordsRes, evidencesRes] = await Promise.all([
      apiClient.get<Activity>(`/activities/${params.activityId}`),
      apiClient.get<ExecutionPeriod[]>(`/contracts/${params.id}/execution-periods`),
      apiClient.get<ExecutionRecordRow[]>(`/activities/${params.activityId}/execution`),
      apiClient.get<EvidenceRow[]>(`/activities/${params.activityId}/evidences`),
    ]);
    setActivity(activityRes.data);
    setPeriods(periodsRes.data);
    setRecords(recordsRes.data);
    setEvidences(evidencesRes.data);
  }

  async function handleRegisterExecution(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await apiClient.post(`/activities/${params.activityId}/execution`, {
        periodId: executionForm.periodId,
        executedQuantity: Number(executionForm.executedQuantity),
        executedValue: Number(executionForm.executedValue),
        executionDate: executionForm.executionDate,
        result: executionForm.result || undefined,
      });
      setMessage({ type: 'ok', text: 'Ejecución registrada correctamente.' });
      setExecutionForm({ periodId: '', executedQuantity: '', executedValue: '', executionDate: '', result: '' });
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'No fue posible registrar la ejecución' });
    }
  }

  async function handleUploadEvidence(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!evidenceFile) {
      setMessage({ type: 'error', text: 'Selecciona un archivo para cargar como evidencia' });
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      formData.append('type', evidenceForm.type);
      formData.append('activityId', params.activityId);
      if (evidenceForm.description) formData.append('description', evidenceForm.description);

      await apiClient.post(`/contracts/${params.id}/evidences`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'ok', text: 'Evidencia cargada correctamente.' });
      setEvidenceForm({ type: 'FOTOGRAFIA', description: '' });
      setEvidenceFile(null);
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'No fue posible cargar la evidencia' });
    }
  }

  if (!activity) {
    return (
      <AppShell>
        <p className="text-sm text-gray-500">Cargando actividad...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-400">Actividad</p>
        <h1 className="text-xl font-bold text-institucional">
          {activity.code} — {activity.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Meta: {activity.plannedQuantity} {activity.unitOfMeasure} · Valor asignado:{' '}
          {Number(activity.assignedValue).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar ejecución del periodo</h2>
          <form onSubmit={handleRegisterExecution} className="space-y-3">
            <Select
              label="Periodo"
              value={executionForm.periodId}
              onChange={(v) => setExecutionForm((f) => ({ ...f, periodId: v }))}
              options={periods.map((p) => ({ value: p.id, label: p.label }))}
              required
            />
            <Field
              label="Cantidad ejecutada"
              type="number"
              value={executionForm.executedQuantity}
              onChange={(v) => setExecutionForm((f) => ({ ...f, executedQuantity: v }))}
              required
            />
            <Field
              label="Valor ejecutado (COP)"
              type="number"
              value={executionForm.executedValue}
              onChange={(v) => setExecutionForm((f) => ({ ...f, executedValue: v }))}
              required
            />
            <Field
              label="Fecha de ejecución"
              type="date"
              value={executionForm.executionDate}
              onChange={(v) => setExecutionForm((f) => ({ ...f, executionDate: v }))}
              required
            />
            <Field
              label="Resultado obtenido"
              value={executionForm.result}
              onChange={(v) => setExecutionForm((f) => ({ ...f, result: v }))}
            />
            <button
              type="submit"
              className="w-full rounded-md bg-institucional py-2 text-sm font-semibold text-white hover:bg-institucional-dark"
            >
              Registrar ejecución
            </button>
          </form>

          <h3 className="mt-6 mb-2 text-xs font-semibold uppercase text-gray-400">Historial</h3>
          <ul className="divide-y divide-gray-100 text-sm">
            {records.map((record) => (
              <li key={record.id} className="py-2">
                <p className="font-medium text-gray-800">
                  {record.period.label} — {record.executedQuantity} unidades ({record.physicalPercentage}%)
                </p>
                <p className="text-xs text-gray-500">
                  {record.executionDate.slice(0, 10)} · {Number(record.executedValue).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                </p>
              </li>
            ))}
            {records.length === 0 && <li className="py-2 text-gray-400">Sin registros de ejecución aún.</li>}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Cargar evidencia</h2>
          <form onSubmit={handleUploadEvidence} className="space-y-3">
            <Select
              label="Tipo de evidencia"
              value={evidenceForm.type}
              onChange={(v) => setEvidenceForm((f) => ({ ...f, type: v }))}
              options={EVIDENCE_TYPES.map((t) => ({ value: t, label: t }))}
              required
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Archivo</label>
              <input
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600"
                required
              />
            </div>
            <Field
              label="Descripción"
              value={evidenceForm.description}
              onChange={(v) => setEvidenceForm((f) => ({ ...f, description: v }))}
            />
            <button
              type="submit"
              className="w-full rounded-md bg-institucional py-2 text-sm font-semibold text-white hover:bg-institucional-dark"
            >
              Cargar evidencia
            </button>
          </form>

          <h3 className="mt-6 mb-2 text-xs font-semibold uppercase text-gray-400">Evidencias cargadas</h3>
          <ul className="divide-y divide-gray-100 text-sm">
            {evidences.map((evidence) => (
              <li key={evidence.id} className="py-2">
                <p className="font-medium text-gray-800">
                  {evidence.type} — {evidence.originalFileName}
                </p>
                <p className="text-xs text-gray-500">{evidence.uploadedAt.slice(0, 10)}</p>
              </li>
            ))}
            {evidences.length === 0 && <li className="py-2 text-gray-400">Sin evidencias cargadas aún.</li>}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
      >
        <option value="">Seleccionar...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
