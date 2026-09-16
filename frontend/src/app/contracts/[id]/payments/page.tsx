'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { hasSession } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import type { Payment, PaymentStatus } from '@/types/api';

const STATUS_OPTIONS: PaymentStatus[] = ['PENDIENTE', 'RADICADO', 'EN_REVISION', 'APROBADO', 'PAGADO', 'RECHAZADO'];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDIENTE: 'Pendiente',
  RADICADO: 'Radicado',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  PAGADO: 'Pagado',
  RECHAZADO: 'Rechazado',
};

const STATUS_CLASSES: Record<PaymentStatus, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-600',
  RADICADO: 'bg-blue-100 text-blue-700',
  EN_REVISION: 'bg-amber-100 text-amber-700',
  APROBADO: 'bg-indigo-100 text-indigo-700',
  PAGADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function ContractPaymentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    periodLabel: '',
    invoiceNumber: '',
    accountNumber: '',
    disbursementNumber: '',
    value: '',
    observations: '',
  });

  const [disbursementDrafts, setDisbursementDrafts] = useState<Record<string, string>>({});

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
      const { data } = await apiClient.get<Payment[]>(`/contracts/${params.id}/payments`);
      setPayments(data);
      setDisbursementDrafts(
        Object.fromEntries(data.map((p) => [p.id, p.disbursementNumber ?? ''])),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await apiClient.post(`/contracts/${params.id}/payments`, {
        periodLabel: form.periodLabel,
        invoiceNumber: form.invoiceNumber || undefined,
        accountNumber: form.accountNumber || undefined,
        disbursementNumber: form.disbursementNumber || undefined,
        value: Number(form.value),
        observations: form.observations || undefined,
      });
      setMessage({ type: 'ok', text: 'Pago registrado correctamente.' });
      setForm({ periodLabel: '', invoiceNumber: '', accountNumber: '', disbursementNumber: '', value: '', observations: '' });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'No fue posible registrar el pago' });
    }
  }

  async function handleStatusChange(paymentId: string, status: PaymentStatus) {
    setMessage(null);
    try {
      const extra: Record<string, string> = {};
      if (status === 'RADICADO') extra.submittedDate = new Date().toISOString();
      if (status === 'PAGADO') extra.paidDate = new Date().toISOString();

      await apiClient.patch(`/payments/${paymentId}`, { status, ...extra });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'No fue posible actualizar el estado' });
    }
  }

  async function handleSaveDisbursement(payment: Payment) {
    const draft = disbursementDrafts[payment.id]?.trim() ?? '';
    if (draft === (payment.disbursementNumber ?? '')) return;

    setMessage(null);
    try {
      await apiClient.patch(`/payments/${payment.id}`, { disbursementNumber: draft || undefined });
      setMessage({ type: 'ok', text: 'Número de egreso actualizado.' });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message ?? 'No fue posible guardar el número de egreso' });
    }
  }

  const totalPagado = payments
    .filter((p) => p.status === 'PAGADO')
    .reduce((acc, p) => acc + Number(p.value), 0);

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-400">Contrato</p>
        <h1 className="text-xl font-bold text-institucional">Pagos y cuentas de cobro</h1>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Historial de pagos</h2>
            <span className="text-xs text-gray-400">
              Total pagado: <span className="font-semibold text-gray-700">{currencyFormatter.format(totalPagado)}</span>
            </span>
          </div>

          {loading && <p className="text-sm text-gray-500">Cargando pagos...</p>}

          {!loading && payments.length === 0 && (
            <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Aún no se han registrado pagos para este contrato.
            </p>
          )}

          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">{payment.periodLabel}</p>
                    <p className="text-xs text-gray-500">
                      {payment.invoiceNumber ? `Factura ${payment.invoiceNumber}` : 'Sin número de factura'}
                      {payment.accountNumber ? ` · Cuenta de cobro ${payment.accountNumber}` : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[payment.status]}`}>
                    {STATUS_LABELS[payment.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-bold text-gray-800">{currencyFormatter.format(Number(payment.value))}</p>
                  <select
                    value={payment.status}
                    onChange={(e) => handleStatusChange(payment.id, e.target.value as PaymentStatus)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 rounded-md border border-institucional/20 bg-institucional/5 p-2.5">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-institucional">
                    Número de egreso
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={disbursementDrafts[payment.id] ?? ''}
                      onChange={(e) =>
                        setDisbursementDrafts((drafts) => ({ ...drafts, [payment.id]: e.target.value }))
                      }
                      placeholder="Ej. EG-2026-000452"
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveDisbursement(payment)}
                      disabled={(disbursementDrafts[payment.id]?.trim() ?? '') === (payment.disbursementNumber ?? '')}
                      className="rounded-md bg-institucional px-3 py-1 text-xs font-semibold text-white hover:bg-institucional-dark disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {(payment.submittedDate || payment.paidDate) && (
                  <p className="mt-2 text-xs text-gray-400">
                    {payment.submittedDate && `Radicado: ${payment.submittedDate.slice(0, 10)}`}
                    {payment.submittedDate && payment.paidDate && ' · '}
                    {payment.paidDate && `Pagado: ${payment.paidDate.slice(0, 10)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar cuenta de cobro</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <Field
              label="Periodo"
              value={form.periodLabel}
              onChange={(v) => setForm((f) => ({ ...f, periodLabel: v }))}
              required
              placeholder="Ej. Septiembre 2026"
            />
            <Field
              label="Número de factura"
              value={form.invoiceNumber}
              onChange={(v) => setForm((f) => ({ ...f, invoiceNumber: v }))}
            />
            <Field
              label="Cuenta de cobro"
              value={form.accountNumber}
              onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
            />
            <Field
              label="Número de egreso"
              value={form.disbursementNumber}
              onChange={(v) => setForm((f) => ({ ...f, disbursementNumber: v }))}
              placeholder="Se suele conocer solo cuando tesorería ejecuta el pago"
            />
            <Field
              label="Valor (COP)"
              type="number"
              value={form.value}
              onChange={(v) => setForm((f) => ({ ...f, value: v }))}
              required
            />
            <Field
              label="Observaciones"
              value={form.observations}
              onChange={(v) => setForm((f) => ({ ...f, observations: v }))}
            />
            <button
              type="submit"
              className="w-full rounded-md bg-institucional py-2 text-sm font-semibold text-white hover:bg-institucional-dark"
            >
              Registrar pago
            </button>
          </form>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
      />
    </div>
  );
}
