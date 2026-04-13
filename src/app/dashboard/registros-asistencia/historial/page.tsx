"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ClipboardList,
  FileDown,
  FileText,
  PlusCircle,
  CheckCircle,
  Clock,
  CalendarDays,
  List,
  Users,
  BookOpen,
  Eye,
  X,
  Copy,
  Link,
  Share2,
  ExternalLink,
  MapPin,
  UserCheck,
  UserX,
  Calendar,
  RefreshCw,
  PenTool,
} from "lucide-react";

interface RegistroResumen {
  id: string;
  idRegistro: string;
  nombreEvento: string;
  ciudad: string;
  fecha: string;
  tipo: string;
  area: string;
  nombreConferencista: string;
  estado: string;
  cantidadAsistentes: number;
}

interface Programacion {
  id: string;
  identificador: string;
  mes: string;
  trimestre: string;
  programado: boolean;
  ejecutado: boolean;
  fechaEjecucion: string;
  totalAsistentes: number;
  capacitacionNombre: string;
  capacitacionCodigo: string;
  observaciones: string;
}

interface AsistenteDetalle {
  id: string;
  nombre: string;
  cedula: string;
  labor: string;
  firmaConfirmada: boolean;
}

interface RegistroDetalle {
  id: string;
  idRegistro: string;
  nombreEvento: string;
  ciudad: string;
  fecha: string;
  lugar: string;
  tipo: string;
  area: string;
  temasTratados: string;
  nombreConferencista: string;
  estado: string;
  tieneFirmaConferencista: boolean;
  asistentes: AsistenteDetalle[];
}

interface SigningLinkItem {
  detalleRecordId: string;
  nombre: string;
  url: string;
}

// ── Signature Canvas Component ──────────────────────────
function SignatureCanvas({
  onConfirm,
  onCancel,
  nombrePersona,
  titulo = "Firma del Conferencista",
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  nombrePersona: string;
  titulo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    hasStrokes.current = true;
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const confirmSignature = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{titulo}</h3>
          <p className="text-sm text-white/60 mt-1">{nombrePersona}</p>
        </div>
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden border border-white/20 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-[160px] cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  <PenTool className="w-4 h-4" /> Firme aquí
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={clearCanvas}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-all"
            >
              Limpiar
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSignature}
                disabled={isEmpty}
                className="px-4 py-2 rounded-lg bg-purple-500/30 border border-purple-400/40 text-white text-sm font-medium hover:bg-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Confirmar Firma
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function HistorialRegistrosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lista" | "calendario">("lista");

  // ── Lista state ───────────────────────────────────────────
  const [registros, setRegistros] = useState<RegistroResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportandoId, setExportandoId] = useState<string | null>(null);
  const [exportandoEvalAuto, setExportandoEvalAuto] = useState(false);
  const [evalAutoProgreso, setEvalAutoProgreso] = useState("");

  // ── Panel de detalle ──────────────────────────────────────
  const [detalle, setDetalle] = useState<RegistroDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [signingLinks, setSigningLinks] = useState<SigningLinkItem[]>([]);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Firma conferencista ───────────────────────────────────
  const [firmandoConferencista, setFirmandoConferencista] = useState(false);
  const [firmandoConferencistaLoading, setFirmandoConferencistaLoading] = useState(false);

  // ── Calendario state ──────────────────────────────────────
  const [programacion, setProgramacion] = useState<Programacion[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);
  const [errorCal, setErrorCal] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // "YYYY-MM-DD"

  // ── Fetch detalle ─────────────────────────────────────────
  const fetchDetalle = useCallback(async (id: string) => {
    setLoadingDetalle(true);
    setSigningLinks([]);
    try {
      const res = await fetch(`/api/registros-asistencia/${id}`);
      const json = await res.json();
      if (json.success) setDetalle(json.data as RegistroDetalle);
      else setError(json.message || "Error cargando detalle");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  const generateSigningLinks = useCallback(async () => {
    if (!detalle) return;
    const unsigned = detalle.asistentes.filter((a) => !a.firmaConfirmada);
    if (unsigned.length === 0) return;
    setGeneratingLinks(true);
    try {
      const res = await fetch("/api/registros-asistencia/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: window.location.origin,
          asistentes: unsigned.map((a) => ({
            detalleRecordId: a.id,
            eventoRecordId: detalle.id,
            nombre: a.nombre,
            cedula: a.cedula,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) setSigningLinks(json.tokens as SigningLinkItem[]);
    } catch {
      setError("Error generando los enlaces");
    } finally {
      setGeneratingLinks(false);
    }
  }, [detalle]);

  const copySigningLink = useCallback(async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }, []);

  // ── Fetch: lista ──────────────────────────────────────────
  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/registros-asistencia");
      const json = await res.json();
      if (json.success) setRegistros(json.data);
      else setError(json.message || "Error cargando registros");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Firmar conferencista y cerrar evento ──────────────────
  const firmarConferencista = useCallback(async (firmaDataUrl: string) => {
    if (!detalle) return;
    setFirmandoConferencistaLoading(true);
    try {
      const res = await fetch("/api/registros-asistencia/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "conferencista",
          registroRecordId: detalle.id,
          firmaDataUrl,
          nombre: detalle.nombreConferencista,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDetalle((prev) => prev ? { ...prev, estado: "Finalizado", tieneFirmaConferencista: true } : prev);
        setFirmandoConferencista(false);
        fetchRegistros();
      } else {
        setError(json.message || "Error guardando firma del conferencista");
      }
    } catch {
      setError("Error guardando firma del conferencista");
    } finally {
      setFirmandoConferencistaLoading(false);
    }
  }, [detalle, fetchRegistros]);

  // ── Fetch: calendario ─────────────────────────────────────
  const fetchProgramacion = useCallback(async () => {
    if (programacion.length > 0) return; // already loaded
    setLoadingCal(true);
    setErrorCal(null);
    try {
      const res = await fetch("/api/programacion-capacitaciones");
      const json = await res.json();
      if (json.success) setProgramacion(json.data);
      else setErrorCal(json.message || "Error cargando programación");
    } catch {
      setErrorCal("Error de conexión");
    } finally {
      setLoadingCal(false);
    }
  }, [programacion.length]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  useEffect(() => {
    if (activeTab === "calendario") fetchProgramacion();
  }, [activeTab, fetchProgramacion]);

  // ── Calendar helpers ──────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Programacion[]>();
    programacion.forEach((p) => {
      if (!p.fechaEjecucion) return;
      const list = map.get(p.fechaEjecucion) ?? [];
      list.push(p);
      map.set(p.fechaEjecucion, list);
    });
    return map;
  }, [programacion]);

  const sinFecha = useMemo(
    () => programacion.filter((p) => !p.fechaEjecucion && p.programado),
    [programacion]
  );

  // Build calendar grid (Mon-first)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Mon=0 … Sun=6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentYear, currentMonth]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const formatDateKey = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDate(null);
  };

  // ── Misc helpers ──────────────────────────────────────────
  const formatFecha = (fechaRaw: string) => {
    if (!fechaRaw) return "—";
    try {
      const d = new Date(fechaRaw + "T12:00:00");
      return d.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch { return fechaRaw; }
  };

  const TIPO_COLORS: Record<string, string> = {
    "Inducción":    "bg-blue-500/20 text-blue-300 border-blue-400/30",
    "Capacitación": "bg-purple-500/20 text-purple-300 border-purple-400/30",
    "Charla":       "bg-green-500/20 text-green-300 border-green-400/30",
    "Capacitaciones/Charlas":         "bg-gray-500/20 text-gray-300 border-gray-400/30",
  };

  const exportarExcel = async (registroId: string, nombreEvento: string) => {
    setExportandoId(registroId);
    try {
      const res = await fetch("/api/registros-asistencia/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registroRecordId: registroId }),
      });
      if (!res.ok) throw new Error("Error al generar el archivo");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asistencia_${nombreEvento.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExportandoId(null);
    }
  };

  const exportarEvaluacionesAuto = async (registroId: string) => {
    setExportandoEvalAuto(true);
    setEvalAutoProgreso("Detectando tipos...");
    try {
      // 1. Detect populations
      const pobRes = await fetch("/api/evaluaciones/poblaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registroRecordId: registroId }),
      });
      const pobJson = await pobRes.json();
      if (!pobJson.success || !pobJson.poblaciones?.length) {
        setError("No se encontraron evaluaciones para este evento");
        return;
      }

      const poblaciones: string[] = pobJson.poblaciones;

      // 2. Generate PDF for each population
      let generados = 0;
      for (const pob of poblaciones) {
        setEvalAutoProgreso(`Generando ${pob} (${generados + 1}/${poblaciones.length})...`);
        try {
          const res = await fetch("/api/evaluaciones/resultado-pdf-unificado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registroRecordId: registroId, tipo: pob }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            console.warn(`No se generó PDF para ${pob}:`, json?.message);
            continue;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const disposition = res.headers.get("Content-Disposition") || "";
          const match = disposition.match(/filename="?([^"]+)"?/);
          a.download = match?.[1] || `Evaluaciones_${pob}.pdf`;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          a.remove();
          generados++;
        } catch (err) {
          console.warn(`Error generando PDF para ${pob}:`, err);
        }
      }

      if (generados === 0) {
        setError("No se pudo generar ningún PDF de evaluaciones");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error exportando evaluaciones");
    } finally {
      setExportandoEvalAuto(false);
      setEvalAutoProgreso("");
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/registros-asistencia")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 backdrop-blur-sm">
                  <ClipboardList className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Historial de Registros</h1>
                  <p className="text-xs text-white/60">Capacitaciones, charlas e inducciones</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tab switcher */}
              <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => setActiveTab("lista")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "lista"
                      ? "bg-white/20 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <List size={15} />
                  <span className="hidden sm:inline">Lista</span>
                </button>
                <button
                  onClick={() => setActiveTab("calendario")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "calendario"
                      ? "bg-white/20 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <CalendarDays size={15} />
                  <span className="hidden sm:inline">Calendario</span>
                </button>
              </div>

              <button
                onClick={() => router.push("/dashboard/registros-asistencia/nuevo")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/25 hover:bg-purple-500/35 text-white border border-purple-400/35 transition-all"
              >
                <PlusCircle size={18} />
                <span className="hidden sm:inline">Nuevo Registro</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── LISTA TAB ─────────────────────────────────── */}
        {activeTab === "lista" && (
          <>
            {error && (
              <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/20 border border-red-500/30 text-white">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p>{error}</p>
              </div>
            )}

            {loading ? (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
              </div>
            ) : registros.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-16 text-center">
                <ClipboardList className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/60 text-lg">No hay registros de asistencia aún</p>
                <button
                  onClick={() => router.push("/dashboard/registros-asistencia/nuevo")}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-purple-500/25 border border-purple-400/35 text-white font-medium hover:bg-purple-500/35 transition-all"
                >
                  Crear el primero
                </button>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <p className="text-white/60 text-sm">{registros.length} registro{registros.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="bg-purple-500/20 border-b border-white/10">
                        <th className="text-left text-xs font-semibold text-white/80 px-4 py-3">Evento</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-4 py-3 w-28">Fecha</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-4 py-3 w-28">Tipo</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-4 py-3 w-28">Área</th>
                        <th className="text-center text-xs font-semibold text-white/80 px-4 py-3 w-24">Asistentes</th>
                        <th className="text-center text-xs font-semibold text-white/80 px-4 py-3 w-28">Estado</th>
                        <th className="text-center text-xs font-semibold text-white/80 px-4 py-3 w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((reg, idx) => (
                        <tr
                          key={reg.id}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                          onClick={() => { setDetalle(null); fetchDetalle(reg.id); }}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-white">{reg.nombreEvento || "—"}</p>
                            {reg.ciudad && <p className="text-xs text-white/50 mt-0.5">{reg.ciudad}</p>}
                            {reg.nombreConferencista && (
                              <p className="text-xs text-purple-300/70 mt-0.5">Conf: {reg.nombreConferencista}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/70">{formatFecha(reg.fecha)}</td>
                          <td className="px-4 py-3">
                            {reg.tipo ? (
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${TIPO_COLORS[reg.tipo] || TIPO_COLORS["Otro"]}`}>
                                {reg.tipo}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/70">{reg.area || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold text-sirius-cielo">{reg.cantidadAsistentes}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {reg.estado === "Completado" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30">
                                <CheckCircle className="w-3 h-3" />Completado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                                <Clock className="w-3 h-3" />Borrador
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => { setDetalle(null); fetchDetalle(reg.id); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-white text-xs font-medium hover:bg-purple-500/30 transition-all cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                Ver
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CALENDARIO TAB ────────────────────────────── */}
        {activeTab === "calendario" && (
          <>
            {errorCal && (
              <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/20 border border-red-500/30 text-white">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p>{errorCal}</p>
              </div>
            )}

            {loadingCal ? (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Calendar card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <button
                      onClick={prevMonth}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="text-center">
                      <h2 className="text-lg font-bold text-white">
                        {MESES[currentMonth]} {currentYear}
                      </h2>
                      <p className="text-xs text-white/50">
                        {programacion.filter((p) => p.fechaEjecucion?.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`)).length} capacitaciones este mes
                      </p>
                    </div>
                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 px-6 py-2.5 border-b border-white/5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      <span className="text-white/60">Ejecutada</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-white/60">Programada</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
                      <span className="text-white/60">Sin ejecutar</span>
                    </div>
                  </div>

                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 border-b border-white/10">
                    {DIAS_SEMANA.map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-white/50">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="border-r border-b border-white/5 min-h-[80px]" />;
                      }
                      const dateKey = formatDateKey(day);
                      const events = eventsByDate.get(dateKey) ?? [];
                      const isToday = dateKey === today;
                      const isSelected = dateKey === selectedDate;

                      return (
                        <button
                          key={dateKey}
                          onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                          className={`border-r border-b border-white/5 min-h-[80px] p-1.5 text-left transition-all relative ${
                            isSelected
                              ? "bg-purple-500/25 border-purple-500/30"
                              : events.length > 0
                              ? "hover:bg-white/10 cursor-pointer"
                              : "hover:bg-white/5 cursor-default"
                          }`}
                        >
                          {/* Day number */}
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                              isToday
                                ? "bg-purple-500 text-white"
                                : "text-white/70"
                            }`}
                          >
                            {day}
                          </span>

                          {/* Event dots / chips */}
                          <div className="flex flex-col gap-0.5">
                            {events.slice(0, 3).map((ev) => (
                              <span
                                key={ev.id}
                                className={`w-full text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium ${
                                  ev.ejecutado
                                    ? "bg-green-500/25 text-green-300"
                                    : ev.programado
                                    ? "bg-amber-500/25 text-amber-300"
                                    : "bg-white/10 text-white/50"
                                }`}
                              >
                                {ev.identificador}
                              </span>
                            ))}
                            {events.length > 3 && (
                              <span className="text-[10px] text-white/40 px-1">
                                +{events.length - 3} más
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected day detail */}
                {selectedDate && (eventsByDate.get(selectedDate)?.length ?? 0) > 0 && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-purple-300" />
                      <h3 className="font-semibold text-white">{formatFecha(selectedDate)}</h3>
                      <span className="text-white/40 text-sm">
                        {eventsByDate.get(selectedDate)!.length} capacitación{eventsByDate.get(selectedDate)!.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {eventsByDate.get(selectedDate)!.map((ev) => (
                        <div key={ev.id} className="px-6 py-4 flex items-start gap-4">
                          <div
                            className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              ev.ejecutado ? "bg-green-400" : ev.programado ? "bg-amber-400" : "bg-white/30"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{ev.identificador}</p>
                            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{ev.capacitacionNombre || "—"}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-white/40">{ev.mes} · {ev.trimestre}</span>
                              {ev.totalAsistentes > 0 && (
                                <span className="flex items-center gap-1 text-xs text-sirius-cielo">
                                  <Users size={10} />
                                  {ev.totalAsistentes} asistentes
                                </span>
                              )}
                              <span
                                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                  ev.ejecutado
                                    ? "bg-green-500/20 text-green-300"
                                    : ev.programado
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-white/10 text-white/50"
                                }`}
                              >
                                {ev.ejecutado ? "Ejecutada" : ev.programado ? "Programada" : "Sin estado"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Programadas sin fecha */}
                {sinFecha.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <h3 className="font-semibold text-white">Programadas sin fecha asignada</h3>
                      <span className="text-white/40 text-sm">{sinFecha.length}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {sinFecha.map((ev) => (
                        <div key={ev.id} className="px-6 py-3 flex items-center gap-4">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{ev.identificador}</p>
                            <p className="text-xs text-white/50 truncate">{ev.capacitacionNombre || "—"}</p>
                          </div>
                          <span className="text-xs text-white/40 whitespace-nowrap">{ev.mes} · {ev.trimestre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── PANEL DE DETALLE ─────────────────────────────── */}
      {(detalle || loadingDetalle) && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => { setDetalle(null); setSigningLinks([]); }}
          />
          {/* Drawer */}
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-slate-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <ClipboardList className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {detalle ? (detalle.idRegistro || "Detalle") : "Cargando..."}
                  </h2>
                  <p className="text-xs text-white/50">{detalle?.tipo || ""}</p>
                </div>
              </div>
              <button
                onClick={() => { setDetalle(null); setSigningLinks([]); }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetalle ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
              </div>
            ) : detalle ? (
              <div className="flex-1 overflow-y-auto">
                {/* Info del evento */}
                <div className="px-6 py-4 space-y-2 border-b border-white/10">
                  <h3 className="text-base font-semibold text-white leading-snug">{detalle.nombreEvento || "—"}</h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/60">
                    {detalle.fecha && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(detalle.fecha + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {detalle.ciudad && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {detalle.ciudad}{detalle.lugar ? ` · ${detalle.lugar}` : ""}
                      </span>
                    )}
                    {detalle.nombreConferencista && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {detalle.nombreConferencista}
                      </span>
                    )}
                  </div>
                  {detalle.temasTratados && (
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{detalle.temasTratados}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {detalle.estado === "Finalizado" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30">
                        <CheckCircle className="w-3 h-3" />Finalizado
                      </span>
                    ) : detalle.estado === "En Curso" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        <Clock className="w-3 h-3" />En Curso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                        <Clock className="w-3 h-3" />Borrador
                      </span>
                    )}
                  </div>
                </div>

                {/* Estadísticas de firma */}
                {detalle.asistentes.length > 0 && (() => {
                  const firmados = detalle.asistentes.filter((a) => a.firmaConfirmada).length;
                  const total = detalle.asistentes.length;
                  const pct = Math.round((firmados / total) * 100);
                  return (
                    <div className="px-6 py-4 border-b border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/70">Firmas</span>
                          <span className="text-sm font-bold text-white">{firmados}/{total}</span>
                          <span className="text-xs text-white/40">{pct}%</span>
                        </div>
                        <button
                          onClick={() => fetchDetalle(detalle.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />Actualizar
                        </button>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-green-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Acción: generar links para los que no han firmado */}
                {detalle.asistentes.some((a) => !a.firmaConfirmada) && (
                  <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                    <p className="text-xs text-white/60">
                      {detalle.asistentes.filter((a) => !a.firmaConfirmada).length} pendientes de firma
                    </p>
                    <button
                      onClick={generateSigningLinks}
                      disabled={generatingLinks}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {generatingLinks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                      {signingLinks.length > 0 ? "Regenerar links" : "Generar links"}
                    </button>
                  </div>
                )}

                {/* Lista de asistentes */}
                <div className="divide-y divide-white/5">
                  {detalle.asistentes.map((a) => {
                    const link = signingLinks.find((l) => l.detalleRecordId === a.id);
                    return (
                      <div key={a.id} className={`px-6 py-3 flex items-center gap-3 ${a.firmaConfirmada ? "bg-green-500/5" : ""}`}>
                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          a.firmaConfirmada ? "bg-green-500/20" : "bg-white/10"
                        }`}>
                          {a.firmaConfirmada
                            ? <UserCheck className="w-4 h-4 text-green-400" />
                            : <UserX className="w-4 h-4 text-white/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{a.nombre || "—"}</p>
                          <p className="text-xs text-white/40">{a.cedula}{a.labor ? ` · ${a.labor}` : ""}</p>
                        </div>
                        {a.firmaConfirmada ? (
                          <span className="shrink-0 text-xs text-green-400 font-medium">Firmado</span>
                        ) : link ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => copySigningLink(link.url, a.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs hover:bg-blue-500/30 transition-all"
                            >
                              {copiedId === a.id ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              {copiedId === a.id ? "Copiado" : "Copiar"}
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="shrink-0 text-xs text-white/30">Pendiente</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer: firma conferencista + exportar */}
                <div className="px-6 py-4 border-t border-white/10 space-y-3">
                  {/* Firma del conferencista */}
                  <div className={`rounded-xl border p-4 ${detalle.tieneFirmaConferencista || detalle.estado === "Finalizado" ? "bg-green-500/10 border-green-500/20" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white flex items-center gap-2">
                          <PenTool className="w-4 h-4 text-purple-300" />
                          Firma del Conferencista
                        </p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {detalle.nombreConferencista || "—"}
                        </p>
                      </div>
                      {detalle.tieneFirmaConferencista || detalle.estado === "Finalizado" ? (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-semibold">Firmado</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setFirmandoConferencista(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/25 border border-purple-400/35 text-purple-200 text-sm font-semibold hover:bg-purple-500/35 transition-all cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          Firmar y Cerrar
                        </button>
                      )}
                    </div>
                    {!(detalle.tieneFirmaConferencista || detalle.estado === "Finalizado") && (
                      <p className="text-[11px] text-white/40 mt-2">
                        Al firmar, el evento quedará marcado como Finalizado
                      </p>
                    )}
                  </div>

                  {/* Export buttons */}
                  <button
                    onClick={() => exportarExcel(detalle.id, detalle.nombreEvento)}
                    disabled={exportandoId === detalle.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sirius-verde/20 border border-sirius-verde/30 text-white font-medium hover:bg-sirius-verde/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {exportandoId === detalle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    Exportar Asistencia
                  </button>
                  <button
                    onClick={() => exportarEvaluacionesAuto(detalle.id)}
                    disabled={exportandoEvalAuto}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/20 border border-violet-400/30 text-white font-medium hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {exportandoEvalAuto ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {exportandoEvalAuto ? evalAutoProgreso : "Exportar Evaluaciones"}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </>
      )}

      {/* Modal firma conferencista */}
      {firmandoConferencista && detalle && (
        <SignatureCanvas
          titulo="Firma del Conferencista"
          nombrePersona={detalle.nombreConferencista || "Conferencista"}
          onConfirm={firmarConferencista}
          onCancel={() => setFirmandoConferencista(false)}
        />
      )}
    </div>
  );
}
