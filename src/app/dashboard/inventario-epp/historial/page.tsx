"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  Package,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FileSpreadsheet,
  RefreshCw,
  User,
  AlertTriangle,
  XCircle,
  Link2,
  Copy,
  Check,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface DetalleEntrega {
  nombreInsumo: string;
  codigoInsumo: string;
  cantidad: number;
  talla: string;
  condicion: string;
}

interface TokenEntrega {
  tokenId: string;
  estado: string;
  fechaGeneracion: string;
}

interface EntregaEPP {
  id: string;
  idEntrega: string;
  fechaEntrega: string;
  responsable: string;
  estado: string;
  motivo: string;
  fechaConfirmacion: string;
  observaciones: string;
  detalles: DetalleEntrega[];
  tokens: TokenEntrega[];
}

interface EmpleadoInfo {
  id: string;
  nombre: string;
  documento: string;
}

interface ResumenStats {
  totalEntregas: number;
  entregasConfirmadas: number;
  entregasPendientes: number;
  entregasAnuladas: number;
  totalEPPsEntregados: number;
  ultimaEntrega: string;
}

interface HistorialResponse {
  empleado: EmpleadoInfo;
  totalEntregas: number;
  entregas: EntregaEPP[];
  resumen: ResumenStats;
}

interface EmpleadoOption {
  id: string;
  nombre: string;
  documento: string;
}

// ══════════════════════════════════════════════════════════
// Helpers - Timezone Colombia
// ══════════════════════════════════════════════════════════
const COLOMBIA_TZ = "America/Bogota";

function formatFecha(iso: string): string {
  if (!iso) return "—";
  try {
    const dateStr = iso.includes("T") ? iso : iso + "T12:00:00";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      timeZone: COLOMBIA_TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getEstadoStyle(estado: string) {
  const styles = {
    Confirmada: {
      bg: "bg-green-500/15",
      color: "text-green-400",
      border: "border-green-400/25",
    },
    Pendiente: {
      bg: "bg-amber-500/15",
      color: "text-amber-400",
      border: "border-amber-400/25",
    },
    Anulada: {
      bg: "bg-red-500/15",
      color: "text-red-400",
      border: "border-red-400/25",
    },
    "En Proceso": {
      bg: "bg-blue-500/15",
      color: "text-blue-400",
      border: "border-blue-400/25",
    },
  };
  return (
    styles[estado as keyof typeof styles] || {
      bg: "bg-white/10",
      color: "text-white/50",
      border: "border-white/15",
    }
  );
}

// ══════════════════════════════════════════════════════════
// Componente de acciones por entrega (Regenerar Token / Enviar Link)
// ══════════════════════════════════════════════════════════
function EntregaAcciones({
  entrega,
  onTokenRegenerado,
}: {
  entrega: EntregaEPP;
  onTokenRegenerado: () => void;
}) {
  const [regenerando, setRegenerando] = useState(false);
  const [linkGenerado, setLinkGenerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);

  const puedeRegenerarOFirmar =
    entrega.estado === "Pendiente" || entrega.estado === "Confirmada";

  const handleRegenerarToken = async () => {
    setRegenerando(true);
    setAccionError(null);
    setLinkGenerado(null);
    try {
      const res = await fetch("/api/entregas-epp/regenerar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregaId: entrega.id }),
      });
      const json = await res.json();
      if (json.success) {
        setLinkGenerado(json.data.urlFirma);
        onTokenRegenerado();
      } else {
        setAccionError(json.message || "Error al regenerar token");
      }
    } catch {
      setAccionError("Error de conexión");
    } finally {
      setRegenerando(false);
    }
  };

  const handleCopiarLink = async () => {
    if (!linkGenerado) return;
    try {
      await navigator.clipboard.writeText(linkGenerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAccionError("No se pudo copiar al portapapeles");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/25 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all cursor-not-allowed opacity-50"
          disabled
          title="Próximamente"
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-2" />
          Descargar PDF
        </button>

        {puedeRegenerarOFirmar && (
          <button
            onClick={handleRegenerarToken}
            disabled={regenerando}
            className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/25 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenerando ? (
              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 inline mr-2" />
            )}
            {entrega.estado === "Confirmada"
              ? "Generar Link (Actualizar Firma)"
              : "Regenerar Token"}
          </button>
        )}
      </div>

      {/* Link generado */}
      {linkGenerado && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-400/20">
          <Link2 className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-xs text-green-300 truncate flex-1 font-mono">
            {linkGenerado}
          </p>
          <button
            onClick={handleCopiarLink}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/25 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition-all cursor-pointer shrink-0"
          >
            {copiado ? (
              <><Check className="w-3.5 h-3.5" /> Copiado</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copiar</>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {accionError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> {accionError}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function HistorialEntregasPage() {
  const router = useRouter();

  // Estados principales
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>("");
  const [empleadoInfo, setEmpleadoInfo] = useState<EmpleadoInfo | null>(null);
  const [entregas, setEntregas] = useState<EntregaEPP[]>([]);
  const [resumen, setResumen] = useState<ResumenStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");

  // UI
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch lista de empleados ──────────────────────────────
  const fetchEmpleados = useCallback(async () => {
    setLoadingEmpleados(true);
    try {
      const res = await fetch("/api/personal");
      const json = await res.json();
      if (json.success) {
        const empleadosData = json.data.map((emp: any) => ({
          id: emp.idEmpleado,
          nombre: emp.nombreCompleto,
          documento: emp.numeroDocumento,
        }));
        setEmpleados(empleadosData);
      } else {
        setError(json.message || "Error al cargar empleados");
      }
    } catch {
      setError("Error de conexión al servidor");
    } finally {
      setLoadingEmpleados(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  // ── Fetch historial de entregas ───────────────────────────
  const fetchHistorial = useCallback(
    async (idEmpleado: string) => {
      if (!idEmpleado) {
        setEntregas([]);
        setResumen(null);
        setEmpleadoInfo(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ idEmpleado });
        if (filterEstado !== "todos") params.set("estado", filterEstado);
        if (fechaDesde) params.set("fechaDesde", fechaDesde);
        if (fechaHasta) params.set("fechaHasta", fechaHasta);

        const res = await fetch(`/api/entregas-epp/historial?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const data: HistorialResponse = json.data;
          setEmpleadoInfo(data.empleado);
          setEntregas(data.entregas);
          setResumen(data.resumen);
        } else {
          setError(json.message || "Error al cargar historial");
        }
      } catch {
        setError("Error de conexión al servidor");
      } finally {
        setLoading(false);
      }
    },
    [filterEstado, fechaDesde, fechaHasta]
  );

  // Recargar cuando cambien filtros
  useEffect(() => {
    if (empleadoSeleccionado) {
      fetchHistorial(empleadoSeleccionado);
    }
  }, [empleadoSeleccionado, filterEstado, fechaDesde, fechaHasta, fetchHistorial]);

  // ── Filtrado local adicional ──────────────────────────────
  const entregasFiltradas = useMemo(() => {
    let filtered = [...entregas];

    // Ordenar por fecha más reciente
    filtered.sort(
      (a, b) =>
        new Date(b.fechaEntrega).getTime() - new Date(a.fechaEntrega).getTime()
    );

    return filtered;
  }, [entregas]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/20032025-DSC_3717.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inventario-epp")}
                className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Inventario
              </button>
              <div className="h-8 w-px bg-white/20" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Historial de Entregas EPP
                  </h1>
                  <p className="text-xs text-white/50">
                    {empleadoInfo
                      ? `${empleadoInfo.nombre} - ${entregas.length} entrega${entregas.length !== 1 ? "s" : ""}`
                      : "Selecciona un empleado para ver su historial"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => empleadoSeleccionado && fetchHistorial(empleadoSeleccionado)}
                disabled={loading || !empleadoSeleccionado}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm hover:bg-white/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Filtros principales ────────────────────────── */}
        <div className="bg-[#0a0a1a]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Selector de empleado */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">
                Empleado
              </label>
              <select
                value={empleadoSeleccionado}
                onChange={(e) => {
                  setEmpleadoSeleccionado(e.target.value);
                  setExpandedId(null);
                }}
                disabled={loadingEmpleados}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400/50 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="bg-gray-900">
                  Seleccionar empleado
                </option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-gray-900">
                    {emp.nombre} ({emp.documento})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro estado */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Estado</label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                disabled={!empleadoSeleccionado}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400/50 transition-all cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="todos" className="bg-gray-900">
                  Todos
                </option>
                <option value="Confirmada" className="bg-gray-900">
                  Confirmada
                </option>
                <option value="Pendiente" className="bg-gray-900">
                  Pendiente
                </option>
                <option value="Anulada" className="bg-gray-900">
                  Anulada
                </option>
              </select>
            </div>

            {/* Fecha desde */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={!empleadoSeleccionado}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={!empleadoSeleccionado}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* ── Tarjetas de estadísticas ──────────────────── */}
        {resumen && empleadoSeleccionado && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {resumen.totalEntregas}
                  </p>
                  <p className="text-xs text-white/60">Total Entregas</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {resumen.entregasConfirmadas}
                  </p>
                  <p className="text-xs text-white/60">Confirmadas</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {resumen.entregasPendientes}
                  </p>
                  <p className="text-xs text-white/60">Pendientes</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {resumen.totalEPPsEntregados}
                  </p>
                  <p className="text-xs text-white/60">EPPs Entregados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────── */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={() => empleadoSeleccionado && fetchHistorial(empleadoSeleccionado)}
              className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition-all cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Estado vacío ────────────────────────────────── */}
        {!loading && !error && entregas.length === 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Sin entregas registradas
            </h3>
            <p className="text-sm text-white/60">
              {empleadoSeleccionado
                ? "Este empleado no tiene entregas de EPP en el rango seleccionado"
                : "Selecciona un empleado para ver su historial"}
            </p>
          </div>
        )}

        {/* ── Lista de entregas (acordeón) ────────────────── */}
        {!loading && !error && entregasFiltradas.length > 0 && (
          <div className="space-y-3">
            {entregasFiltradas.map((entrega) => {
              const isExpanded = expandedId === entrega.id;
              const estadoStyle = getEstadoStyle(entrega.estado);

              return (
                <div
                  key={entrega.id}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Header colapsable */}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entrega.id)
                    }
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-4">
                      {/* Badge de estado */}
                      <div
                        className={`px-3 py-1 rounded-lg ${estadoStyle.bg} border ${estadoStyle.border}`}
                      >
                        <span
                          className={`text-xs font-semibold ${estadoStyle.color}`}
                        >
                          {entrega.estado}
                        </span>
                      </div>

                      {/* Info principal */}
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">
                          {entrega.idEntrega}
                        </p>
                        <p className="text-xs text-white/60">
                          {formatFecha(entrega.fechaEntrega)} · {entrega.motivo}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Contador de EPPs */}
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/20">
                        <Package className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400">
                          {entrega.detalles.length} EPPs
                        </span>
                      </div>

                      {/* Chevron */}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white/60" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/60" />
                      )}
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                      {/* Lista de EPPs */}
                      <div className="space-y-3 mb-4">
                        <p className="text-xs text-white/60 uppercase tracking-wide font-semibold">
                          Elementos entregados
                        </p>
                        {entrega.detalles.map((det, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <Package className="w-4 h-4 text-blue-400" />
                              <div>
                                <p className="text-sm text-white">
                                  {det.nombreInsumo}
                                </p>
                                <p className="text-xs text-white/50">
                                  {det.codigoInsumo} · Talla {det.talla} ·{" "}
                                  {det.condicion}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-blue-400">
                              × {det.cantidad}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                          <p className="text-xs text-white/60 mb-1">
                            Responsable
                          </p>
                          <p className="text-sm text-white">
                            {entrega.responsable || "—"}
                          </p>
                        </div>
                        {entrega.fechaConfirmacion && (
                          <div>
                            <p className="text-xs text-white/60 mb-1">
                              Fecha confirmación
                            </p>
                            <p className="text-sm text-white">
                              {formatFecha(entrega.fechaConfirmacion)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Observaciones */}
                      {entrega.observaciones && (
                        <div className="mt-4 p-3 rounded-xl bg-white/5">
                          <p className="text-xs text-white/60 mb-1">
                            Observaciones
                          </p>
                          <p className="text-sm text-white/80">
                            {entrega.observaciones}
                          </p>
                        </div>
                      )}

                      {/* Tokens */}
                      {entrega.tokens.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verificación y Firma
                          </h3>
                          <div className="space-y-2">
                            {entrega.tokens.map((tok, idx) => {
                              const tokenEstado =
                                tok.estado === "Usado"
                                  ? "bg-green-500/15 text-green-400 border-green-400/25"
                                  : tok.estado === "Activo"
                                  ? "bg-amber-500/15 text-amber-400 border-amber-400/25"
                                  : "bg-red-500/15 text-red-400 border-red-400/25";
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                                >
                                  <div className="flex-1">
                                    <p className="text-xs text-white/60 font-mono">
                                      Token: {tok.tokenId.slice(0, 12)}...
                                    </p>
                                  </div>
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tokenEstado}`}
                                  >
                                    {tok.estado}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      <EntregaAcciones
                        entrega={entrega}
                        onTokenRegenerado={() => fetchHistorial(empleadoSeleccionado)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
