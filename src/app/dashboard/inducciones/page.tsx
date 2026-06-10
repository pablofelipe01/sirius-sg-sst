"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";
import type { EstadoColaborador } from "@/shared/types/inducciones";
import { formatFechaColombia } from "@/shared/utils";

type FiltroEstado = "TODOS" | "AL_DIA" | "POR_VENCER" | "VENCIDA" | "SIN_INDUCCION";

interface Stats {
  total: number;
  alDia: number;
  porVencer: number;
  vencidas: number;
  sinInduccion: number;
  alertasActivas: number;
}

export default function InduccionesDashboardPage() {
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState<EstadoColaborador[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/inducciones/dashboard");
      const data = await response.json();

      if (data.success) {
        setColaboradores(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar colaboradores
  const colaboradoresFiltrados = colaboradores.filter((col) => {
    // Filtro por estado
    if (filtroEstado !== "TODOS" && col.estadoSemaforo !== filtroEstado) {
      return false;
    }

    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      return (
        col.nombreCompleto.toLowerCase().includes(searchLower) ||
        col.numeroDocumento.includes(searchLower) ||
        col.cargo.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Función para obtener color del semáforo
  const getSemaforoColor = (estado: string) => {
    switch (estado) {
      case "AL_DIA":
        return "bg-green-500";
      case "POR_VENCER":
        return "bg-yellow-500";
      case "VENCIDA":
        return "bg-red-500";
      case "SIN_INDUCCION":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getSemaforoLabel = (estado: string) => {
    switch (estado) {
      case "AL_DIA":
        return "Al día";
      case "POR_VENCER":
        return "Por vencer";
      case "VENCIDA":
        return "Vencida";
      case "SIN_INDUCCION":
        return "Sin inducción";
      default:
        return "Desconocido";
    }
  };

  const getSemaforoIcon = (estado: string) => {
    switch (estado) {
      case "AL_DIA":
        return <CheckCircle2 size={20} />;
      case "POR_VENCER":
        return <Clock size={20} />;
      case "VENCIDA":
        return <AlertTriangle size={20} />;
      case "SIN_INDUCCION":
        return <AlertCircle size={20} />;
      default:
        return <AlertCircle size={20} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="Sirius" width={240} height={64} className="h-16 w-auto" priority />
              <div className="hidden sm:block h-8 w-px bg-white/20" />
              <p className="hidden sm:block text-sm font-semibold text-white/70 tracking-wide uppercase">
                Inducciones y Reinducciones
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              Volver al Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-600/20 backdrop-blur-xl rounded-2xl border border-white/15 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2" style={{ textShadow: "0 2px 15px rgba(0,0,0,0.4)" }}>
                Gestión de Inducciones
              </h1>
              <p className="text-white/70 text-lg">
                Control y seguimiento de inducciones y reinducciones del personal
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/inducciones/nueva")}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <UserPlus size={20} />
              Registrar Inducción
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <Users className="mx-auto mb-2 text-blue-400" size={24} />
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-white/60 mt-1">Total</div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 text-green-400" size={24} />
              <div className="text-3xl font-bold text-green-400">{stats.alDia}</div>
              <div className="text-xs text-white/60 mt-1">Al día</div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <Clock className="mx-auto mb-2 text-yellow-400" size={24} />
              <div className="text-3xl font-bold text-yellow-400">{stats.porVencer}</div>
              <div className="text-xs text-white/60 mt-1">Por vencer</div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <AlertTriangle className="mx-auto mb-2 text-red-400" size={24} />
              <div className="text-3xl font-bold text-red-400">{stats.vencidas}</div>
              <div className="text-xs text-white/60 mt-1">Vencidas</div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 text-gray-400" size={24} />
              <div className="text-3xl font-bold text-gray-400">{stats.sinInduccion}</div>
              <div className="text-xs text-white/60 mt-1">Sin inducción</div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4 text-center">
              <TrendingUp className="mx-auto mb-2 text-orange-400" size={24} />
              <div className="text-3xl font-bold text-orange-400">{stats.alertasActivas}</div>
              <div className="text-xs text-white/60 mt-1">Alertas activas</div>
            </div>
          </div>
        )}

        {/* Alertas Activas */}
        {stats && stats.alertasActivas > 0 && (
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-xl rounded-xl border border-orange-400/30 p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="text-orange-300" size={28} />
              <div>
                <h3 className="text-xl font-bold text-white">Alertas de Vencimiento</h3>
                <p className="text-white/70 text-sm">
                  {stats.alertasActivas} colaborador{stats.alertasActivas !== 1 ? "es" : ""} requieren atención
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leyenda del Semáforo */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-xl border border-white/15 p-5 mb-6">
          <h4 className="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Leyenda del Semáforo
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
              <div>
                <p className="text-sm font-semibold text-white">Al día</p>
                <p className="text-xs text-white/60">Vigencia &gt; 15 días</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
              <div>
                <p className="text-sm font-semibold text-white">Por vencer</p>
                <p className="text-xs text-white/60">Vence en ≤ 15 días</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
              <div>
                <p className="text-sm font-semibold text-white">Vencida</p>
                <p className="text-xs text-white/60">Ya expiró</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-4 h-4 rounded-full bg-gray-400 shadow-lg shadow-gray-400/50" />
              <div>
                <p className="text-sm font-semibold text-white">Sin inducción</p>
                <p className="text-xs text-white/60">Nunca inductado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, documento o cargo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
              </div>
            </div>

            {/* Filtro por estado */}
            <div className="flex items-center gap-2">
              <Filter className="text-white/60" size={20} />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="AL_DIA">Al día</option>
                <option value="POR_VENCER">Por vencer</option>
                <option value="VENCIDA">Vencidas</option>
                <option value="SIN_INDUCCION">Sin inducción</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Colaboradores */}
        <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Estado</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Colaborador</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Documento</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Cargo</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Última Inducción</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Vencimiento</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Días restantes</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-white/80">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center px-6 py-12 text-white/60">
                      Cargando...
                    </td>
                  </tr>
                ) : colaboradoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center px-6 py-12 text-white/60">
                      No se encontraron colaboradores
                    </td>
                  </tr>
                ) : (
                  colaboradoresFiltrados.map((col) => (
                    <tr key={col.idEmpleadoCore} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getSemaforoColor(col.estadoSemaforo)}`} />
                          <span className="text-sm text-white/70">{getSemaforoLabel(col.estadoSemaforo)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{col.nombreCompleto}</div>
                      </td>
                      <td className="px-6 py-4 text-white/70 text-sm">{col.numeroDocumento}</td>
                      <td className="px-6 py-4 text-white/70 text-sm">{col.cargo}</td>
                      <td className="px-6 py-4 text-white/70 text-sm">
                        {col.ultimaInduccion ? (
                          <div>
                            <div className="font-medium text-white">
                              {col.ultimaInduccion.tipo === "Induccion" ? "Inducción" : "Reinducción"}
                            </div>
                            <div className="text-xs text-white/50">
                              {formatFechaColombia(col.ultimaInduccion.fechaRealizacion, { format: "numeric" })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white/70 text-sm">
                        {col.ultimaInduccion ? (
                          formatFechaColombia(col.ultimaInduccion.fechaVencimiento, { format: "numeric" })
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {col.diasParaVencimiento !== null ? (
                          <span
                            className={`text-sm font-semibold ${
                              col.diasParaVencimiento < 0
                                ? "text-red-400"
                                : col.diasParaVencimiento <= 15
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }`}
                          >
                            {col.diasParaVencimiento < 0
                              ? `Vencida hace ${Math.abs(col.diasParaVencimiento)} días`
                              : `${col.diasParaVencimiento} días`}
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/inducciones/nueva?emp=${col.idEmpleadoCore}`)}
                            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                            title="Registrar nueva inducción"
                          >
                            Registrar
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            onClick={() => router.push(`/dashboard/inducciones/colaborador/${col.idEmpleadoCore}`)}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                            title="Ver historial completo"
                          >
                            Historial
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
