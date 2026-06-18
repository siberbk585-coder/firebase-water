import { AppShell } from "@/components/AppShell";
import { requireCollector } from "@/lib/guards";
import { collectorNav } from "@/lib/vi";

export default async function CollectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCollector();
  return (
    <AppShell user={user} nav={[...collectorNav]}>
      {children}
    </AppShell>
  );
}
