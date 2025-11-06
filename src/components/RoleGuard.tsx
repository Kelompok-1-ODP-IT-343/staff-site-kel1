'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentUser } from '@/services/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    const normalizedRole = (user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map((role) => role.toUpperCase());

    if (!normalizedAllowed.includes(normalizedRole)) {
      // Redirect to appropriate page based on role
      switch (normalizedRole) {
        case 'APPROVER':
          router.push('/dashboard');
          break;
        case 'ADMIN':
          router.push('/dashboard');
          break;
        default:
          router.push('/login');
      }
    }
  }, [allowedRoles, router]);

  return <>{children}</>;
}