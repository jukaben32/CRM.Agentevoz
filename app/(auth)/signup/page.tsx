"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, WarningCircle, CircleNotch } from "@phosphor-icons/react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, businessName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo completar el registro.");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-stone-100 dark:bg-stone-950">
      <div className="w-full max-w-md">
        {/* Logo & Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-500 mb-3 shadow-inner">
            <Wrench size={28} weight="duotone" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            VoiceOps CRM
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Da de alta tu taller mecánico y activa tu recepcionista con IA
          </p>
        </div>

        {/* Tarjeta de Registro */}
        <div className="card-saas p-7 shadow-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-1">
            Crear cuenta de negocio
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-5">
            Configuración inicial automática de catálogo, horarios y agente de voz
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <WarningCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Nombre de tu taller mecánico
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: Talleres Hermanos Ruiz"
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Tu nombre y apellidos
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Juan Ruiz"
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@talleresruiz.es"
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Contraseña (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  <span>Creando taller...</span>
                </>
              ) : (
                <span>Crear cuenta y empezar</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 text-center">
            <p className="text-xs text-stone-400">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-orange-600 dark:text-orange-400 font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
