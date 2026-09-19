"use client";

import React, { useState, useTransition } from "react";
import {
  User as UserIcon,
  ShieldCheck,
  Buildings,
  CalendarBlank,
  SignOut,
  Laptop,
  Clock,
  Fingerprint,
} from "@phosphor-icons/react";
import { formatRole, roleBadgeClasses } from "@/lib/labels";
import { useRouter } from "next/navigation";

interface ProfileViewProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    created_at: string | Date;
  };
  activeSessions: Array<{
    id: string;
    user_agent: string | null;
    ip: string | null;
    created_at: string | Date;
    expires_at: string | Date;
  }>;
  business: {
    id: string;
    name: string;
    timezone: string;
  };
  role: "owner" | "staff";
}

export function ProfileView({ user, activeSessions, business, role }: ProfileViewProps) {
  const router = useRouter();
  const [isLoggingOut, startLogout] = useTransition();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleLogout = () => {
    startLogout(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    });
  };

  const formatDate = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Mi Perfil</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Información personal, rol en la plataforma y gestión de sesiones activas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tarjeta de Usuario */}
        <div className="md:col-span-1 bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 border-2 border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-500 text-2xl font-bold">
            {getInitials(user.full_name)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{user.full_name}</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">{user.email}</p>
          </div>
          <div className="pt-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeClasses(
                role
              )}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {formatRole(role)}
            </span>
          </div>

          <div className="w-full pt-4 border-t border-stone-200 dark:border-stone-800 text-left space-y-3">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <CalendarBlank className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <span>
                Registrado: <strong>{formatDate(user.created_at)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <Fingerprint className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <span className="truncate" title={user.id}>
                ID: <code className="font-mono text-[10px]">{user.id}</code>
              </span>
            </div>
          </div>

          <div className="w-full pt-4">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              <SignOut className="w-4 h-4" />
              {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        </div>

        {/* Datos de Negocio y Sesiones */}
        <div className="md:col-span-2 space-y-6">
          {/* Negocio Asignado */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Buildings className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                <h3 className="font-bold text-stone-900 dark:text-stone-100">Negocio Asociado</h3>
              </div>
              <span className="text-xs px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-300 font-medium">
                Zona horaria: {business.timezone}
              </span>
            </div>
            <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
              <div className="text-base font-semibold text-stone-900 dark:text-stone-100">{business.name}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 font-mono">
                <span>Tenant ID:</span>
                <span>{business.id}</span>
              </div>
            </div>
          </div>

          {/* Sesiones Activas */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                <h3 className="font-bold text-stone-900 dark:text-stone-100">Sesiones Activas ({activeSessions.length})</h3>
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400">Tokens de sesión SHA-256</span>
            </div>

            <div className="space-y-3">
              {activeSessions.map((s, idx) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>IP: {s.ip || "127.0.0.1"}</span>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-900/50">
                          Sesión actual
                        </span>
                      )}
                    </div>
                    <p className="text-stone-500 dark:text-stone-400 text-[11px] truncate max-w-md font-mono" title={s.user_agent || ""}>
                      {s.user_agent || "Navegador web desconocido"}
                    </p>
                  </div>

                  <div className="text-stone-500 dark:text-stone-400 sm:text-right space-y-0.5">
                    <div className="flex items-center sm:justify-end gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                      <span>Creada: {formatDate(s.created_at)}</span>
                    </div>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500">
                      Expira: {formatDate(s.expires_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
