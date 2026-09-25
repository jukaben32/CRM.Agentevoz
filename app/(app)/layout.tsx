import { requireSession } from "@/lib/auth/guards";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-100 dark:bg-stone-950">
      {/* Sidebar desktop - oculto en móviles */}
      <div className="hidden md:block">
        <Sidebar session={session} />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Hamburger menu móvil - visible solo en móviles */}
        <MobileNav session={session} />
        {children}
      </main>
    </div>
  );
}
