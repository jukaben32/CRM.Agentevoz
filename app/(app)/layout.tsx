import { requireSession } from "@/lib/auth/guards";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-100 dark:bg-stone-950">
      <Sidebar session={session} />
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
