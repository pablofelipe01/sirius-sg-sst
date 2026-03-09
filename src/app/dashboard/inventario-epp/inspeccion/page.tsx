"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
  X,
  Users,
  Calendar,
  User,
  FileDown,
  Save,
  PenTool,
  Eraser,
  Check,
  History,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface PersonalItem {
  id: string;
  idEmpleado: string;
  nombreCompleto: string;
  numeroDocumento: string;
  tipoPersonal: string;
  estado: string;
  fotoPerfil: { url: string; filename: string } | null;
}

// Condición del EPP: B=Bueno, R=Regular, M=Malo, NA=No Aplica
type CondicionEPP = "B" | "R" | "M" | "NA" | null;

// Categorías de EPP para inspección
const CATEGORIAS_EPP = [
  { id: "casco", label: "Casco", shortLabel: "Casco" },
  { id: "proteccion_auditiva", label: "Protección Auditiva", shortLabel: "P. Auditiva" },
  { id: "proteccion_visual", label: "Protección Visual", shortLabel: "P. Visual" },
  { id: "proteccion_respiratoria", label: "Protección Respiratoria", shortLabel: "P. Resp." },
  { id: "ropa_trabajo", label: "Indumentaria", shortLabel: "Indument." },
  { id: "guantes", label: "Guantes", shortLabel: "Guantes" },
  { id: "botas_seguridad", label: "Botas de Seguridad", shortLabel: "Botas" },
  { id: "proteccion_caidas", label: "Protección de Caídas", shortLabel: "P. Caídas" },
  { id: "otros", label: "Otros", shortLabel: "Otros" },
] as const;

type CategoriaEPPId = (typeof CATEGORIAS_EPP)[number]["id"];

interface InspeccionEmpleado {
  id: string;
  persona: PersonalItem;
  condiciones: Record<CategoriaEPPId, CondicionEPP>;
  observaciones: string;
  firma: string | null; // Base64 data URL de la firma
}

type PageState = "idle" | "saving" | "success" | "error";

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
let _uid = 0;
function uid() {
  return `insp-${++_uid}-${Date.now()}`;
}

function formatDate(date: Date): string {
  // Formato YYYY-MM-DD en timezone Colombia
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// Colores para las condiciones
const CONDICION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  B: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  R: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
  M: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  NA: { bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-300" },
};

// ══════════════════════════════════════════════════════════
// Componente Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  onCancel,
  empleadoNombre,
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  empleadoNombre: string;
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
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
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

  const stopDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const confirmSignature = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Firma del Trabajador</h3>
          <p className="text-sm text-white/60 mt-1">{empleadoNombre}</p>
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
                  <PenTool className="w-4 h-4" />
                  Firme aquí
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={clearCanvas}
              className="flex-1 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm font-medium hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eraser className="w-4 h-4" />
              Limpiar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={confirmSignature}
              disabled={isEmpty}
              className="flex-1 py-2.5 rounded-lg bg-green-500/25 border border-green-400/30 text-green-300 text-sm font-semibold hover:bg-green-500/35 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════
export default function InspeccionEPPPage() {
  const router = useRouter();
  const { user } = useSession();

  // Estados principales
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Datos del formulario
  const [fechaInspeccion, setFechaInspeccion] = useState(formatDate(new Date()));
  const [inspector, setInspector] = useState("");
  const [inspecciones, setInspecciones] = useState<InspeccionEmpleado[]>([]);

  // Personal
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal de firma
  const [firmandoEmpleadoId, setFirmandoEmpleadoId] = useState<string | null>(null);

  // Cargar personal al iniciar y crear inspecciones para todos
  const fetchPersonal = useCallback(async () => {
    setLoadingPersonal(true);
    try {
      const res = await fetch("/api/personal");
      const json = await res.json();
      if (json.success) {
        // Crear una inspección para cada empleado automáticamente
        const inspeccionesIniciales: InspeccionEmpleado[] = json.data.map(
          (persona: PersonalItem) => ({
            id: uid(),
            persona,
            condiciones: {
              casco: null,
              proteccion_auditiva: null,
              proteccion_visual: null,
              proteccion_respiratoria: null,
              ropa_trabajo: null,
              guantes: null,
              botas_seguridad: null,
              proteccion_caidas: null,
              otros: null,
            },
            observaciones: "",
            firma: null,
          })
        );
        setInspecciones(inspeccionesIniciales);
      }
    } catch {
      console.error("Error cargando personal");
    } finally {
      setLoadingPersonal(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonal();
  }, [fetchPersonal]);

  // Setear inspector cuando el usuario está disponible
  useEffect(() => {
    if (user?.nombreCompleto && !inspector) {
      setInspector(user.nombreCompleto);
    }
  }, [user, inspector]);

  // Filtrar inspecciones por búsqueda
  const inspeccionesFiltradas = inspecciones.filter(
    (i) =>
      i.persona.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.persona.numeroDocumento.includes(searchQuery)
  );

  // Actualizar condición de EPP
  const actualizarCondicion = (
    inspeccionId: string,
    categoria: CategoriaEPPId,
    condicion: CondicionEPP
  ) => {
    setInspecciones((prev) =>
      prev.map((i) =>
        i.id === inspeccionId
          ? { ...i, condiciones: { ...i.condiciones, [categoria]: condicion } }
          : i
      )
    );
  };

  // Actualizar observaciones
  const actualizarObservaciones = (inspeccionId: string, obs: string) => {
    setInspecciones((prev) =>
      prev.map((i) => (i.id === inspeccionId ? { ...i, observaciones: obs } : i))
    );
  };

  // Actualizar firma
  const actualizarFirma = (inspeccionId: string, firma: string) => {
    setInspecciones((prev) =>
      prev.map((i) => (i.id === inspeccionId ? { ...i, firma } : i))
    );
    setFirmandoEmpleadoId(null);
  };

  // Obtener el empleado que está firmando
  const empleadoFirmando = firmandoEmpleadoId
    ? inspecciones.find((i) => i.id === firmandoEmpleadoId)
    : null;

  // Estadísticas
  const totalEmpleados = inspecciones.length;
  const empleadosFirmados = inspecciones.filter((i) => i.firma !== null).length;
  const empleadosConInspeccion = inspecciones.filter((i) =>
    Object.values(i.condiciones).some((c) => c !== null)
  ).length;

  // Guardar inspección
  const guardarInspeccion = async () => {
    // Solo guardar los que tienen firma
    const inspeccionesConFirma = inspecciones.filter((i) => i.firma !== null);
    
    if (inspeccionesConFirma.length === 0) {
      setErrorMessage("Debe haber al menos un empleado con firma para guardar");
      return;
    }

    setPageState("saving");
    setErrorMessage(null);

    try {
      const payload = {
        fechaInspeccion,
        inspector,
        inspecciones: inspeccionesConFirma.map((i) => ({
          empleadoId: i.persona.id,
          idEmpleado: i.persona.idEmpleado,
          nombreCompleto: i.persona.nombreCompleto,
          condiciones: i.condiciones,
          observaciones: i.observaciones,
          firma: i.firma,
        })),
      };

      const res = await fetch("/api/inspecciones-epp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setPageState("success");
      } else {
        throw new Error(json.message || "Error al guardar la inspección");
      }
    } catch (err) {
      setPageState("error");
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  // Exportar a Excel
  const exportarExcel = async () => {
    const inspeccionesConFirma = inspecciones.filter((i) => i.firma !== null);
    
    if (inspeccionesConFirma.length === 0) {
      setErrorMessage("No hay empleados con firma para exportar");
      return;
    }

    try {
      const payload = {
        fechaInspeccion,
        inspector,
        inspecciones: inspeccionesConFirma.map((i) => ({
          empleadoId: i.persona.id,
          idEmpleado: i.persona.idEmpleado,
          nombreCompleto: i.persona.nombreCompleto,
          condiciones: i.condiciones,
          observaciones: i.observaciones,
          firma: i.firma,
        })),
      };

      const res = await fetch("/api/inspecciones-epp/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Error al generar el archivo");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspeccion_EPP_${fechaInspeccion}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error al exportar");
    }
  };

  // ══════════════════════════════════════════════════════════
  // Renderizado
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inspecciones")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sirius-azul/20 backdrop-blur-sm">
                  <ClipboardCheck className="w-6 h-6 text-sirius-cielo" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Inspección Condición de EPP</h1>
                  <p className="text-xs text-white/60">Registro de condición de elementos</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/inventario-epp/inspeccion/historial")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <History size={18} />
                <span className="hidden sm:inline">Historial</span>
              </button>
              <button
                onClick={exportarExcel}
                disabled={empleadosFirmados === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sirius-verde/20 hover:bg-sirius-verde/30 text-white border border-sirius-verde/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <FileDown size={18} />
                <span className="hidden sm:inline">Exportar Excel</span>
              </button>
              <button
                onClick={guardarInspeccion}
                disabled={pageState === "saving" || empleadosFirmados === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sirius-azul hover:bg-sirius-azul/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {pageState === "saving" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span className="hidden sm:inline">Guardar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mensajes de estado */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-white">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p>{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-auto p-1 hover:bg-white/10 rounded"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {pageState === "success" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-white">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p>Inspección guardada exitosamente</p>
          </div>
        )}

        {/* Datos generales */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sirius-cielo" />
            Datos de la Inspección
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Fecha de Inspección
              </label>
              <input
                type="date"
                value={fechaInspeccion}
                onChange={(e) => setFechaInspeccion(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sirius-cielo/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Inspector / Responsable
              </label>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                placeholder="Nombre del inspector"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sirius-cielo/50"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2.5 rounded-lg bg-sirius-verde/20 border border-sirius-verde/30">
                <p className="text-xs text-white/60">Empleados firmados</p>
                <p className="text-xl font-bold text-green-400">{empleadosFirmados} / {totalEmpleados}</p>
              </div>
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2.5 rounded-lg bg-sirius-cielo/20 border border-sirius-cielo/30">
                <p className="text-xs text-white/60">Con inspección</p>
                <p className="text-xl font-bold text-sirius-cielo">{empleadosConInspeccion}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Búsqueda y título */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-sirius-cielo" />
            Lista de Empleados ({inspeccionesFiltradas.length})
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar empleado..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sirius-cielo/50 text-sm"
            />
          </div>
        </div>

        {/* Tabla de inspección */}
        {loadingPersonal ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-sirius-cielo animate-spin" />
          </div>
        ) : inspeccionesFiltradas.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No se encontraron empleados</p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="bg-sirius-azul/30 border-b border-white/10">
                    <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-10">
                      #
                    </th>
                    <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-44">
                      Empleado
                    </th>
                    {CATEGORIAS_EPP.map((cat) => (
                      <th
                        key={cat.id}
                        className="text-center text-xs font-semibold text-white/80 px-1 py-3 w-16"
                      >
                        <span className="hidden xl:inline">{cat.label}</span>
                        <span className="xl:hidden">{cat.shortLabel}</span>
                      </th>
                    ))}
                    <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-32">
                      Observaciones
                    </th>
                    <th className="text-center text-xs font-semibold text-white/80 px-3 py-3 w-28">
                      Firma
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inspeccionesFiltradas.map((insp, idx) => (
                    <tr
                      key={insp.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        insp.firma ? "bg-green-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-white/60 text-sm">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {insp.persona.fotoPerfil ? (
                            <Image
                              src={insp.persona.fotoPerfil.url}
                              alt=""
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-sirius-azul/30 flex items-center justify-center">
                              <User className="w-4 h-4 text-white/60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {insp.persona.nombreCompleto}
                            </p>
                            <p className="text-xs text-white/50">{insp.persona.numeroDocumento}</p>
                          </div>
                        </div>
                      </td>
                      {CATEGORIAS_EPP.map((cat) => (
                        <td key={cat.id} className="px-1 py-2 text-center">
                          <CondicionSelector
                            value={insp.condiciones[cat.id]}
                            onChange={(val) => actualizarCondicion(insp.id, cat.id, val)}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={insp.observaciones}
                          onChange={(e) => actualizarObservaciones(insp.id, e.target.value)}
                          placeholder="Obs..."
                          className="w-full px-2 py-1.5 text-xs rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-sirius-cielo/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {insp.firma ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400 font-medium">Firmado</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setFirmandoEmpleadoId(insp.id)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-sirius-cielo/20 border border-sirius-cielo/30 text-sirius-cielo text-xs font-medium hover:bg-sirius-cielo/30 transition-all"
                          >
                            <PenTool className="w-3 h-3" />
                            Firmar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leyenda */}
            <div className="px-4 py-3 bg-white/5 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/60">
              <span className="font-medium text-white/80">Leyenda:</span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center font-bold">
                  B
                </span>
                Bueno
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold">
                  R
                </span>
                Regular
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  M
                </span>
                Malo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[10px]">
                  N/A
                </span>
                No Aplica
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Modal de firma */}
      {empleadoFirmando && (
        <SignatureCanvas
          empleadoNombre={empleadoFirmando.persona.nombreCompleto}
          onConfirm={(dataUrl) => actualizarFirma(empleadoFirmando.id, dataUrl)}
          onCancel={() => setFirmandoEmpleadoId(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Selector de Condición
// ══════════════════════════════════════════════════════════
function CondicionSelector({
  value,
  onChange,
}: {
  value: CondicionEPP;
  onChange: (val: CondicionEPP) => void;
}) {
  const opciones: { val: CondicionEPP; label: string }[] = [
    { val: "B", label: "B" },
    { val: "R", label: "R" },
    { val: "M", label: "M" },
    { val: "NA", label: "N/A" },
  ];

  return (
    <div className="flex gap-0.5 justify-center">
      {opciones.map((op) => {
        const isSelected = value === op.val;
        const colors = op.val ? CONDICION_COLORS[op.val] : null;

        return (
          <button
            key={op.val}
            onClick={() => onChange(isSelected ? null : op.val)}
            className={`
              w-6 h-6 rounded text-[10px] font-bold transition-all
              ${
                isSelected && colors
                  ? `${colors.bg} ${colors.text} ${colors.border} border`
                  : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60"
              }
            `}
            title={
              op.val === "B"
                ? "Bueno"
                : op.val === "R"
                  ? "Regular"
                  : op.val === "M"
                    ? "Malo"
                    : "No Aplica"
            }
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
