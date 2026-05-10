import { WebAuthPanel } from '../../components/WebAuthPanel';

type AuthPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

function safeRedirectTarget(value?: string | string[]) {
  const target = Array.isArray(value) ? value[0] : value;
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/trades';
  if (target.startsWith('/auth')) return '/trades';
  return target;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirectTarget(params?.next);

  return (
    <section className="auth-page-shell">
      <WebAuthPanel redirectTo={redirectTo} />
    </section>
  );
}
