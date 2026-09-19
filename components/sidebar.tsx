"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  CaretLineLeft,
  CaretLineRight,
} from "@phosphor-icons/react";
import { SessionData } from "@/lib/auth/session";
import { useTheme } from "@/lib/hooks/use-theme";

interface SidebarProps {
  session: SessionData;
}

const SIDEBAR_COLLAPSED_KEY = "voiceops-sidebar-collapsed";

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Menú colapsado (solo iconos) o expandido (iconos + texto).
  // Se recuerda en localStorage para que no cambie cada vez que se recarga la página.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // Si localStorage no está disponible, se queda expandido por defecto
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Igual que arriba: si falla, simplemente no persiste
      }
      return next;
    });
  }, []);

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
    <aside
      className={`${collapsed ? "w-[76px]" : "w-64"} bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col h-full shrink-0 transition-[width] duration-200 ease-in-out`}
    >
      {/* Cabecera del Negocio */}
      <div className="p-5 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-500 flex items-center justify-center font-bold shrink-0">
            <Wrench size={22} weight="duotone" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                {session.businessName}
              </div>
              <div className="text-xs text-stone-500 truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                {session.role === "owner" ? "Propietario" : "Empleado"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-semibold"
                  : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              {isActive && <div className="nav-active-indicator" />}
              <Icon size={18} weight={isActive ? "fill" : "regular"} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Tema y colapso del menú */}
      <div className="p-3 border-t border-stone-100 dark:border-stone-800 space-y-1">
        <button
          type="button"
          onClick={toggleTheme}
          title={collapsed ? "Cambiar tema" : undefined}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200 transition-all cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          {!collapsed && <span>Tema {theme === "dark" ? "oscuro" : "claro"}</span>}
        </button>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menú" : undefined}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-200 transition-all cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? <CaretLineRight size={18} /> : <CaretLineLeft size={18} />}
          {!collapsed && <span>Colapsar menú</span>}
        </button>
      </div>

      {/* Pie de Usuario y Logout */}
      <div className="p-3 border-t border-stone-100 dark:border-stone-800">
        <div
          className={`flex items-center p-2 rounded-xl bg-stone-50 dark:bg-stone-800/40 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <div className="truncate mr-2">
              <div className="text-xs font-medium text-stone-900 dark:text-stone-200 truncate">
                {session.userName}
              </div>
              <div className="text-[11px] text-stone-500 truncate">{session.userEmail}</div>
            </div>
          )}
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              title="Cerrar sesión"
              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-white dark:hover:bg-stone-800 cursor-pointer"
            >
              <SignOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
