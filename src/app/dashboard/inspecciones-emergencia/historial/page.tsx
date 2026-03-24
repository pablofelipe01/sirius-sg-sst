"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Calendar,
  User,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Flame,
  Cross,
  ShieldAlert,
  Droplets,
  Filter,
  RefreshCw,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type TipoInspeccion = "Extintor" | "Botiquín" | "Camilla" | "Kit Derrames" | "Todos";

interface InspeccionResumen {
  id: string;
  idInspeccion: string;
  fecha: string;
  inspector: string;
  estado: string;
  observaciones: string;
  urlDocumento?: string;
  detallesCount: number;
  tipo: TipoInspeccion;
}

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  Extintor: { icon: <Flame className="w-4 h-4" />, color: "text-red-400 bg-red-500/20" },
  Botiquín: { icon: <Cross className="w-4 h-4" />, color: "text-green-400 bg-green-500/20" },
  Camilla: { icon: <ShieldAlert className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/20" },
  "Kit Derrames": { icon: <Droplets className="w-4 h-4" />, color: "text-yellow-400 bg-yellow-500/20" },
};

const ESTADO_COLORS: Record<string, string> = {
  Borrador: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "En Proceso": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Completada: "bg-green-500/20 text-green-400 border-green-500/30",
  Exportada: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function HistorialInspeccionesEmergenciaPage() {
  const router = useRouter();
  const [inspecciones, setInspecciones] = useState<InspeccionResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoInspeccion>("Todos");

  const cargarInspecciones = useCallback(async () => {
    setLoading(true);
    try {
      const tipos: { tipo: TipoInspeccion; endpoint: string }[] = [
        { tipo: "Extintor", endpoint: "/api/inspecciones-extintor" },
        { tipo: "Botiquín", endpoint: "/api/inspecciones-botiquin" },
        { tipo: "Camilla", endpoint: "/api/inspecciones-camilla" },
        { tipo: "Kit Derrames", endpoint: "/api/inspecciones-kit-derrames" },
      ];

      const promises = tipos.map(async ({ tipo, endpoint }) => {
        try {
          const res = await fetch(endpoint);
          const data = await res.json();
          if (data.success && data.inspecciones) {
            return data.inspecciones.map((insp: Omit<InspeccionResumen, "tipo">) => ({
              ...insp,
              tipo,
            }));
          }
          return [];
        } catch {
          return [];
        }
      });

      const results = await Promise.all(promises);
      const todas = results
        .flat()
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setInspecciones(todas);
    } catch (error) {
      console.error("Error cargando inspecciones:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarInspecciones();
  }, [cargarInspecciones]);

  const inspeccionesFiltradas =
    filtroTipo === "Todos" ? inspecciones : inspecciones.filter((i) => i.tipo === filtroTipo);

  const formatFecha = (fecha: string) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/inspecciones-emergencia")}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Historial de Inspecciones</h1>
              <p className="text-gray-400 text-sm">Inspecciones de equipos de emergencia</p>
            </div>
          </div>
          <button
            onClick={cargarInspecciones}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Actualizar</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400 mr-2">Filtrar por tipo:</span>
            {(["Todos", "Extintor", "Botiquín", "Camilla", "Kit Derrames"] as TipoInspeccion[]).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filtroTipo === tipo
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {tipo !== "Todos" && TIPO_CONFIG[tipo] && (
                  <span className="mr-1.5">{TIPO_CONFIG[tipo].icon}</span>
                )}
                {tipo}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de inspecciones */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <span className="ml-3 text-gray-400">Cargando inspecciones...</span>
            </div>
          ) : inspeccionesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p>No hay inspecciones registradas</p>
              <button
                onClick={() => router.push("/dashboard/inspecciones-emergencia")}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
              >
                Crear nueva inspección
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {inspeccionesFiltradas.map((insp) => (
                <div
                  key={`${insp.tipo}-${insp.id}`}
                  className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {/* Icono tipo */}
                      <div className={`p-2 rounded-lg ${TIPO_CONFIG[insp.tipo]?.color || "bg-gray-500/20"}`}>
                        {TIPO_CONFIG[insp.tipo]?.icon || <FileText className="w-4 h-4" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{insp.idInspeccion}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs border ${
                              ESTADO_COLORS[insp.estado] || ESTADO_COLORS.Borrador
                            }`}
                          >
                            {insp.estado}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatFecha(insp.fecha)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {insp.inspector || "Sin asignar"}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {insp.detallesCount} equipos
                          </span>
                        </div>
                        {insp.observaciones && (
                          <p className="text-xs text-gray-500 line-clamp-1">{insp.observaciones}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400">{insp.tipo}</span>
                      {insp.urlDocumento && (
                        <a
                          href={insp.urlDocumento}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="w-4 h-4 text-blue-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{inspecciones.length}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          {Object.entries(TIPO_CONFIG).map(([tipo, config]) => (
            <div key={tipo} className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {inspecciones.filter((i) => i.tipo === tipo).length}
              </p>
              <p className={`text-xs ${config.color.split(" ")[0]}`}>{tipo}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
