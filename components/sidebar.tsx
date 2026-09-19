"use client";

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
} from "@phosphor-icons/react";
import { SessionData } from "@/lib/auth/session";

interface SidebarProps {
  session: SessionData;
}

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();

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
    <aside className="w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col h-full shrink-0">
      {/* Cabecera del Negocio */}
      <div className="p-5 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-500 flex items-center justify-center font-bold">
            <Wrench size={22} weight="duotone" />
          </div>
          <div className="truncate">
            <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
              {session.businessName}
            </div>
            <div className="text-xs text-stone-500 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {session.role === "owner" ? "Propietario" : "Empleado"}
            </div>
          </div>
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
              className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
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

      {/* Pie de Usuario y Logout */}
      <div className="p-3 border-t border-stone-100 dark:border-stone-800">
        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/40">
          <div className="truncate mr-2">
            <div className="text-xs font-medium text-stone-900 dark:text-stone-200 truncate">
              {session.userName}
            </div>
            <div className="text-[11px] text-stone-500 truncate">{session.userEmail}</div>
          </div>
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
