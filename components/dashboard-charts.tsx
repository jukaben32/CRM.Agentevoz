"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface DashboardChartsProps {
  data: Array<{
    label: string;
    llamadas: number;
    citas: number;
    coste: number;
  }>;
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  if (data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-saas p-6 texture-stripes h-72 flex items-center justify-center text-xs text-stone-400">
          Sin datos de llamadas en este periodo
        </div>
        <div className="card-saas p-6 texture-stripes h-72 flex items-center justify-center text-xs text-stone-400">
          Sin datos de costes en este periodo
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfica 1: Llamadas vs Citas */}
      <div className="card-saas p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Llamadas vs. Citas agendadas
            </h2>
            <p className="text-xs text-stone-500">Evolución de volumen de atención y conversión</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DED9" vertical={false} opacity={0.5} />
              <XAxis dataKey="label" stroke="#A8A29E" fontSize={11} tickLine={false} />
              <YAxis stroke="#A8A29E" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1C1917",
                  border: "none",
                  borderRadius: "0.75rem",
                  color: "#FFFFFF",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="llamadas"
                name="Llamadas"
                stroke="#E8490C"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="citas"
                name="Citas cerradas"
                stroke="#3D5FA8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfica 2: Coste de Llamadas en USD */}
      <div className="card-saas p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Coste de llamadas ($ USD)
            </h2>
            <p className="text-xs text-stone-500">Gasto generado en consumo de telefonía e IA</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DED9" vertical={false} opacity={0.5} />
              <XAxis dataKey="label" stroke="#A8A29E" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#A8A29E"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "Coste"]}
                contentStyle={{
                  backgroundColor: "#1C1917",
                  border: "none",
                  borderRadius: "0.75rem",
                  color: "#FFFFFF",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="coste"
                name="Coste ($)"
                fill="#0D9488"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
