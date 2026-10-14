import { Header } from '@/components/Header';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') ? params.next : '/';

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-transparent">
          <Header authed={false} />
          <main className="flex items-start justify-center px-4 pt-16 pb-20">
            <LoginForm next={next} />
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
