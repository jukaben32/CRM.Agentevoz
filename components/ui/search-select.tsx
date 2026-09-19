"use client";

import React, { useState, useRef, useEffect } from "react";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  isRecommended?: boolean;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className = "",
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Foco automático en el buscador al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtrado insensible a acentos y mayúsculas
  const normalizeText = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredOptions = options.filter((o) => {
    const term = normalizeText(search);
    return (
      normalizeText(o.label).includes(term) ||
      (o.sublabel && normalizeText(o.sublabel).includes(term))
    );
  });

  const recommendedOptions = filteredOptions.filter((o) => o.isRecommended);
  const regularOptions = filteredOptions.filter((o) => !o.isRecommended);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="field flex items-center justify-between text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-zinc-400">{placeholder}</span>}
        </span>
        <CaretDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[260px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none focus:border-orange-500 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-zinc-400">No se encontraron resultados</div>
            ) : (
              <>
                {recommendedOptions.length > 0 && (
                  <div className="mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Recomendados
                    </div>
                    {recommendedOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          opt.value === value
                            ? "bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 font-medium"
                            : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200"
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="truncate font-medium">{opt.label}</div>
                          {opt.sublabel && <div className="text-[11px] text-zinc-400 truncate">{opt.sublabel}</div>}
                        </div>
                        {opt.value === value && <Check size={14} className="text-orange-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}

                {regularOptions.length > 0 && (
                  <div>
                    {recommendedOptions.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Todos
                      </div>
                    )}
                    {regularOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          opt.value === value
                            ? "bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 font-medium"
                            : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200"
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="truncate font-medium">{opt.label}</div>
                          {opt.sublabel && <div className="text-[11px] text-zinc-400 truncate">{opt.sublabel}</div>}
                        </div>
                        {opt.value === value && <Check size={14} className="text-orange-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
