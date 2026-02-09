/**
 * Next.js instrumentation hook — runs exactly once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use this to start the background job runner so it doesn't depend on
 * the first API request hitting a job route.
 */
export async function register() {
  // Only run on the Node.js server runtime, not on Edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobRunner } = await import('@/lib/server/jobRunner');
    startJobRunner();
  }
}
