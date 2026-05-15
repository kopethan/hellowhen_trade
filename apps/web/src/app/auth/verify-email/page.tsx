import { Suspense } from 'react';
import { VerifyEmailClient } from '../../../features/auth/VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailClient />
    </Suspense>
  );
}
