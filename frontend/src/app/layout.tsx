import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CONTRACTUS 360',
  description: 'Sistema de gestión y seguimiento contractual para el contratista.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
