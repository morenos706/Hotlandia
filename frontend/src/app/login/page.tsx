'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { saveSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('contratista.demo@contractus360.local');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      saveSession(data.accessToken, data.user);
      router.push('/contracts');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-institucional">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-institucional">CONTRACTUS 360</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistema de gestión y seguimiento contractual — acceso del contratista
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
            />
          </div>

          {error && <p className="text-sm text-estado-rojo">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-institucional py-2 text-sm font-semibold text-white hover:bg-institucional-dark disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Usuario de demostración precargado. Este sistema es una herramienta de gestión interna y no
          reemplaza SECOP II.
        </p>
      </div>
    </div>
  );
}
