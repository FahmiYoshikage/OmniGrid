/**
 * Next.js calls register() once per server process at startup.
 * We use it to apply DB migrations so the app is always schema-current.
 * Docs: https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrate } = await import("@/lib/db/migrate");
  const result = migrate();
  console.log(
    `[omnigrid] db schema v${result.current}` +
      (result.applied.length ? ` (newly applied: ${result.applied.join(", ")})` : ""),
  );
}
