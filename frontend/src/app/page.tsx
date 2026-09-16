'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasSession } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasSession() ? '/contracts' : '/login');
  }, [router]);

  return null;
}
