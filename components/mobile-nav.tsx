"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  X,
  SquaresFour,
  CalendarCheck,
  AddressBook,
  PhoneCall,
  SlidersHorizontal,
  PlugsConnected,
  UserCircle,
  SignOut,
  Wrench,
  Sun,
  Moon,
} from "@phosphor-icons/react";
import { SessionData } from "@/lib/auth/session";
import { useTheme } from "@/lib/hooks/use-theme";

interface MobileNavProps {
  session: SessionData;
}

export function MobileNav({ session }: MobileNavProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Cerrar menú al cambiar de página
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/", label: "Panel de control", icon: SquaresFour },
    { href: "/agenda", label: "Agenda de citas", icon: CalendarCheck },
    { href: "/contactos", label: "Contactos CRM", icon: AddressBook },
    { href: "/conversaciones", label: "Conversaciones", icon: PhoneCall },
    { href: "/estudio", label: "Ajustes del Agente", icon: SlidersHorizontal },
    { href: "/conexiones", label: "Conexiones VAPI", icon: PlugsConnected },
    { href: "/perfil", label: "Mi perfil", icon: UserCircle },
  ];

  return (
    <>
      {/* Header móvil con hamburger */}
      <header className="md:hidden bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-500 flex items-center justify-center font-bold flex-shrink-0">
            <Wrench size={18} weight="duotone" />
          </div>
          <div className="truncate min-w-0">
            <div className="font-semibold text-xs text-stone-900 dark:text-stone-100 truncate">
              {session.businessName}
            </div>
            <div className="text-[10px] text-stone-500 truncate flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block flex-shrink-0"></span>
              {session.role === "owner" ? "Propietario" : "Empleado"}
            </div>
          </div>
        </div>

        {/* Hamburger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 flex-shrink-0"
          aria-label="Abrir menú"
        >
          {isOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </header>

      {/* Overlay - cierra el menú al hacer click fuera */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer menú - aparece desde la izquierda en móviles */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 z-50 transform transition-transform duration-200 ease-in-out md:hidden overflow-y-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Navegación Principal */}
        <nav className="p-3 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-semibold"
                    : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200"
                }`}
              >
                {isActive && <div className="nav-active-indicator" />}
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Tema */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800 space-y-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200 transition-all cursor-pointer"
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            <span>Tema {theme === "dark" ? "oscuro" : "claro"}</span>
          </button>
        </div>

        {/* Pie de Usuario y Logout */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/40">
            <div className="truncate mr-2">
              <div className="text-xs font-medium text-stone-900 dark:text-stone-200 truncate">
                {session.userName}
              </div>
              <div className="text-[11px] text-stone-500 truncate">
                {session.userEmail}
              </div>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title="Cerrar sesión"
                className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-white dark:hover:bg-stone-800 cursor-pointer flex-shrink-0"
              >
                <SignOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
