import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/guards";
import { adminNav } from "@/lib/vi";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <AppShell user={user} nav={[...adminNav]}>
      {children}
    </AppShell>
  );
}
