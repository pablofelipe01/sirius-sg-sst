"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Calendar,
  Save,
  PenTool,
  Eraser,
  Check,
  History,
  Flame,
  MapPin,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface EquipoItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  tipoEspecifico: string;
  area: string;
  ubicacion: string;
  capacidad: string;
  fechaVencimiento: string | null;
  estado: string;
  descripcion: string;
}

type CondicionEquipo = "Bueno" | "Malo" | "NA" | null;

// Criterios comunes a todos los equipos
interface CriteriosComunes {
  [key: string]: CondicionEquipo;
  estadoGeneral: CondicionEquipo;
  senalizacion: CondicionEquipo;
  accesibilidad: CondicionEquipo;
}

// Criterios adicionales por categoría
interface CriteriosExtintor {
  [key: string]: CondicionEquipo;
  presionManometro: CondicionEquipo;
  manguera: CondicionEquipo;
  pinSeguridad: CondicionEquipo;
  soporteBase: CondicionEquipo;
}

interface CriteriosBotiquin {
  [key: string]: CondicionEquipo;
  completitudElementos: CondicionEquipo;
  estadoContenedor: CondicionEquipo;
}

interface CriteriosCamilla {
  [key: string]: CondicionEquipo;
  estructura: CondicionEquipo;
  correasArnes: CondicionEquipo;
}

interface InspeccionEquipo {
  equipoId: string;
  equipo: EquipoItem;
  criteriosComunes: CriteriosComunes;
  criteriosExtintor: CriteriosExtintor;
  criteriosBotiquin: CriteriosBotiquin;
  criteriosCamilla: CriteriosCamilla;
  fechaVencimiento: string;
  observaciones: string;
}

interface FirmaResponsable {
  tipo: "Responsable" | "COPASST";
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string | null;
}

type PageState = "idle" | "saving" | "success" | "error";

// ══════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════
const CATEGORIAS = ["Extintor", "Botiquín", "Camilla", "Kit Derrames"] as const;

const CATEGORIA_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  Extintor:        { color: "text-red-400",    bgColor: "bg-red-500/20",    borderColor: "border-red-500/30",    icon: "🧯" },
  Botiquín:        { color: "text-green-400",  bgColor: "bg-green-500/20",  borderColor: "border-green-500/30",  icon: "🩹" },
  Camilla:         { color: "text-blue-400",   bgColor: "bg-blue-500/20",   borderColor: "border-blue-500/30",   icon: "🛏️" },
  "Kit Derrames":  { color: "text-yellow-400", bgColor: "bg-yellow-500/20", borderColor: "border-yellow-500/30", icon: "⚠️" },
};

const CRITERIOS_COMUNES_LABELS: { key: string; label: string; shortLabel: string }[] = [
  { key: "estadoGeneral",  label: "Estado General",  shortLabel: "Estado" },
  { key: "senalizacion",   label: "Señalización",    shortLabel: "Señal." },
  { key: "accesibilidad",  label: "Accesibilidad",   shortLabel: "Acces." },
];

const CRITERIOS_EXTINTOR_LABELS: { key: string; label: string; shortLabel: string }[] = [
  { key: "presionManometro", label: "Presión / Manómetro", shortLabel: "Presión" },
  { key: "manguera",         label: "Manguera",            shortLabel: "Manguera" },
  { key: "pinSeguridad",     label: "Pin de Seguridad",    shortLabel: "Pin Seg." },
  { key: "soporteBase",      label: "Soporte / Base",      shortLabel: "Soporte" },
];

const CRITERIOS_BOTIQUIN_LABELS: { key: string; label: string; shortLabel: string }[] = [
  { key: "completitudElementos", label: "Completitud Elementos", shortLabel: "Complet." },
  { key: "estadoContenedor",     label: "Estado Contenedor",     shortLabel: "Conten." },
];

const CRITERIOS_CAMILLA_LABELS: { key: string; label: string; shortLabel: string }[] = [
  { key: "estructura",   label: "Estructura",      shortLabel: "Estruct." },
  { key: "correasArnes", label: "Correas / Arnés", shortLabel: "Correas" },
];

const CONDICION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bueno: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  Malo:  { bg: "bg-red-100",   text: "text-red-700",   border: "border-red-300"   },
  NA:    { bg: "bg-gray-100",  text: "text-gray-500",  border: "border-gray-300"  },
};

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function getCriteriosForCategoria(categoria: string) {
  const criterios: { key: string; label: string; shortLabel: string; group: string }[] = [];
  CRITERIOS_COMUNES_LABELS.forEach((c) =>
    criterios.push({ ...c, group: "comunes" })
  );

  switch (categoria) {
    case "Extintor":
      CRITERIOS_EXTINTOR_LABELS.forEach((c) =>
        criterios.push({ ...c, group: "extintor" })
      );
      break;
    case "Botiquín":
      CRITERIOS_BOTIQUIN_LABELS.forEach((c) =>
        criterios.push({ ...c, group: "botiquin" })
      );
      break;
    case "Kit Derrames":
      CRITERIOS_BOTIQUIN_LABELS.forEach((c) =>
        criterios.push({ ...c, group: "botiquin" })
      );
      break;
    case "Camilla":
      CRITERIOS_CAMILLA_LABELS.forEach((c) =>
        criterios.push({ ...c, group: "camilla" })
      );
      break;
  }
  return criterios;
}

function createEmptyInspeccion(equipo: EquipoItem): InspeccionEquipo {
  return {
    equipoId: equipo.id,
    equipo,
    criteriosComunes: { estadoGeneral: null, senalizacion: null, accesibilidad: null },
    criteriosExtintor: { presionManometro: null, manguera: null, pinSeguridad: null, soporteBase: null },
    criteriosBotiquin: { completitudElementos: null, estadoContenedor: null },
    criteriosCamilla: { estructura: null, correasArnes: null },
    fechaVencimiento: equipo.fechaVencimiento || "",
    observaciones: "",
  };
}

// ══════════════════════════════════════════════════════════
// Componente Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  onCancel,
  titulo,
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  titulo: string;
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
          <h3 className="text-lg font-semibold text-white">Firma</h3>
          <p className="text-sm text-white/60 mt-1">{titulo}</p>
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
// Componente Selector de Condición
// ══════════════════════════════════════════════════════════
function CondicionSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: CondicionEquipo;
  onChange: (val: CondicionEquipo) => void;
  disabled?: boolean;
}) {
  const opciones: { val: CondicionEquipo; label: string; shortLabel: string }[] = [
    { val: "Bueno", label: "Bueno", shortLabel: "B" },
    { val: "Malo",  label: "Malo",  shortLabel: "M" },
    { val: "NA",    label: "N/A",   shortLabel: "N/A" },
  ];

  return (
    <div className="flex gap-0.5 justify-center">
      {opciones.map((op) => {
        const isSelected = value === op.val;
        const colors = op.val ? CONDICION_COLORS[op.val] : null;

        return (
          <button
            key={op.val}
            onClick={() => !disabled && onChange(isSelected ? null : op.val)}
            disabled={disabled}
            className={`
              w-7 h-6 rounded text-[10px] font-bold transition-all
              ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
              ${
                isSelected && colors
                  ? `${colors.bg} ${colors.text} ${colors.border} border`
                  : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60"
              }
            `}
            title={op.label}
          >
            {op.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════
export default function InspeccionEquiposPage() {
  const router = useRouter();
  const { user } = useSession();

  // Estados principales
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Datos del formulario
  const [fechaInspeccion, setFechaInspeccion] = useState(formatDate(new Date()));
  const [inspector, setInspector] = useState("");
  const [observacionesGenerales, setObservacionesGenerales] = useState("");
  const [inspecciones, setInspecciones] = useState<InspeccionEquipo[]>([]);

  // Equipos
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("Todas");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [areas, setAreas] = useState<string[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});

  // Firmas
  const [firmas, setFirmas] = useState<FirmaResponsable[]>([
    { tipo: "Responsable", nombre: "", cedula: "", cargo: "", firma: null },
    { tipo: "COPASST",     nombre: "", cedula: "", cargo: "", firma: null },
  ]);
  const [firmandoIndex, setFirmandoIndex] = useState<number | null>(null);

  // Cargar equipos al iniciar
  const fetchEquipos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipos-emergencia");
      const json = await res.json();
      if (json.success && json.data) {
        const equipos: EquipoItem[] = json.data;
        const inspeccionesIniciales = equipos.map(createEmptyInspeccion);
        setInspecciones(inspeccionesIniciales);

        // Extraer áreas únicas
        const areasUnicas = [...new Set(equipos.map((e) => e.area))].filter(Boolean).sort();
        setAreas(areasUnicas);

        // Expandir todas las áreas por defecto
        const expanded: Record<string, boolean> = {};
        areasUnicas.forEach((a) => (expanded[a] = true));
        setExpandedAreas(expanded);
      }
    } catch {
      console.error("Error cargando equipos");
      setErrorMessage("Error al cargar los equipos de emergencia");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipos();
  }, [fetchEquipos]);

  // Setear inspector
  useEffect(() => {
    if (user?.nombreCompleto && !inspector) {
      setInspector(user.nombreCompleto);
    }
  }, [user, inspector]);

  // Filtrar inspecciones
  const inspeccionesFiltradas = inspecciones.filter((i) => {
    const matchSearch =
      searchQuery === "" ||
      i.equipo.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.equipo.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.equipo.ubicacion.toLowerCase().includes(searchQuery.toLowerCase());

    const matchArea = areaFilter === "Todas" || i.equipo.area === areaFilter;
    const matchCategoria = categoriaFilter === "Todas" || i.equipo.categoria === categoriaFilter;

    return matchSearch && matchArea && matchCategoria;
  });

  // Agrupar por área
  const equiposPorArea = inspeccionesFiltradas.reduce(
    (acc, insp) => {
      const area = insp.equipo.area || "Sin Área";
      if (!acc[area]) acc[area] = [];
      acc[area].push(insp);
      return acc;
    },
    {} as Record<string, InspeccionEquipo[]>
  );

  // Toggle área expandida
  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  // Actualizar criterio
  const actualizarCriterio = (
    equipoId: string,
    group: string,
    key: string,
    value: CondicionEquipo
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        const updated = { ...i };
        switch (group) {
          case "comunes":
            updated.criteriosComunes = { ...i.criteriosComunes, [key]: value };
            break;
          case "extintor":
            updated.criteriosExtintor = { ...i.criteriosExtintor, [key]: value };
            break;
          case "botiquin":
            updated.criteriosBotiquin = { ...i.criteriosBotiquin, [key]: value };
            break;
          case "camilla":
            updated.criteriosCamilla = { ...i.criteriosCamilla, [key]: value };
            break;
        }
        return updated;
      })
    );
  };

  // Actualizar observaciones de equipos
  const actualizarObservaciones = (equipoId: string, obs: string) => {
    setInspecciones((prev) =>
      prev.map((i) => (i.equipoId === equipoId ? { ...i, observaciones: obs } : i))
    );
  };

  // Actualizar fecha vencimiento
  const actualizarFechaVencimiento = (equipoId: string, fecha: string) => {
    setInspecciones((prev) =>
      prev.map((i) => (i.equipoId === equipoId ? { ...i, fechaVencimiento: fecha } : i))
    );
  };

  // Firmas
  const actualizarFirmaData = (index: number, field: keyof FirmaResponsable, value: string) => {
    setFirmas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const confirmarFirma = (dataUrl: string) => {
    if (firmandoIndex === null) return;
    setFirmas((prev) =>
      prev.map((f, i) => (i === firmandoIndex ? { ...f, firma: dataUrl } : f))
    );
    setFirmandoIndex(null);
  };

  // Estadísticas
  const totalEquipos = inspecciones.length;
  const equiposInspeccionados = inspecciones.filter((i) => {
    const criterios = getCriteriosForCategoria(i.equipo.categoria);
    return criterios.some((c) => {
      const groupMap: Record<string, Record<string, CondicionEquipo>> = {
        comunes: i.criteriosComunes,
        extintor: i.criteriosExtintor,
        botiquin: i.criteriosBotiquin,
        camilla: i.criteriosCamilla,
      };
      return groupMap[c.group]?.[c.key] !== null;
    });
  }).length;

  const firmasCompletas = firmas.filter((f) => f.firma !== null).length;

  // Guardar inspección
  const guardarInspeccion = async () => {
    const conInspeccion = inspecciones.filter((i) => {
      const criterios = getCriteriosForCategoria(i.equipo.categoria);
      return criterios.some((c) => {
        const groupMap: Record<string, Record<string, CondicionEquipo>> = {
          comunes: i.criteriosComunes,
          extintor: i.criteriosExtintor,
          botiquin: i.criteriosBotiquin,
          camilla: i.criteriosCamilla,
        };
        return groupMap[c.group]?.[c.key] !== null;
      });
    });

    if (conInspeccion.length === 0) {
      setErrorMessage("Debe inspeccionar al menos un equipo");
      return;
    }

    if (firmasCompletas === 0) {
      setErrorMessage("Debe incluir al menos una firma de responsable");
      return;
    }

    setPageState("saving");
    setErrorMessage(null);

    try {
      const detalles = conInspeccion.map((i) => ({
        equipoRecordId: i.equipoId,
        codigoEquipo: i.equipo.codigo,
        nombreEquipo: i.equipo.nombre,
        categoria: i.equipo.categoria,
        area: i.equipo.area,
        estadoGeneral: i.criteriosComunes.estadoGeneral,
        senalizacion: i.criteriosComunes.senalizacion,
        accesibilidad: i.criteriosComunes.accesibilidad,
        presionManometro: i.criteriosExtintor.presionManometro,
        manguera: i.criteriosExtintor.manguera,
        pinSeguridad: i.criteriosExtintor.pinSeguridad,
        soporteBase: i.criteriosExtintor.soporteBase,
        completitudElementos: i.criteriosBotiquin.completitudElementos,
        estadoContenedor: i.criteriosBotiquin.estadoContenedor,
        estructura: i.criteriosCamilla.estructura,
        correasArnes: i.criteriosCamilla.correasArnes,
        fechaVencimiento: i.fechaVencimiento || null,
        observaciones: i.observaciones,
      }));

      const responsables = firmas
        .filter((f) => f.firma !== null && f.nombre.trim() !== "")
        .map((f) => ({
          tipo: f.tipo,
          nombre: f.nombre,
          cedula: f.cedula,
          cargo: f.cargo,
          firma: f.firma!,
        }));

      const payload = {
        fechaInspeccion,
        inspector,
        observacionesGenerales,
        detalles,
        responsables,
      };

      const res = await fetch("/api/inspecciones-equipos", {
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
                onClick={() => router.push("/dashboard")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/20 backdrop-blur-sm">
                  <Flame className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Inspección Equipos de Emergencia</h1>
                  <p className="text-xs text-white/60">Extintores, botiquines, camillas y kits</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/inspecciones-equipos/historial")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <History size={18} />
                <span className="hidden sm:inline">Historial</span>
              </button>
              <button
                onClick={guardarInspeccion}
                disabled={pageState === "saving" || equiposInspeccionados === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm">{errorMessage}</p>
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
            <Calendar className="w-5 h-5 text-red-400" />
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
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
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
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30">
                <p className="text-xs text-white/60">Equipos inspeccionados</p>
                <p className="text-xl font-bold text-red-400">
                  {equiposInspeccionados} / {totalEquipos}
                </p>
              </div>
            </div>
            <div className="flex items-end">
              <div className="w-full px-4 py-2.5 rounded-lg bg-green-500/20 border border-green-500/30">
                <p className="text-xs text-white/60">Firmas completadas</p>
                <p className="text-xl font-bold text-green-400">{firmasCompletas} / 2</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar equipo por nombre, código o ubicación..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50 text-sm"
              />
            </div>

            {/* Filtro por Área */}
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
            >
              <option value="Todas" className="bg-slate-800">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a} className="bg-slate-800">
                  {a}
                </option>
              ))}
            </select>

            {/* Filtro por Categoría */}
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
            >
              <option value="Todas" className="bg-slate-800">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} className="bg-slate-800">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipos por Área */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
        ) : Object.keys(equiposPorArea).length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <Flame className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No se encontraron equipos</p>
            <p className="text-white/40 text-sm mt-1">
              Agrega equipos en la tabla &quot;Equipos Emergencia&quot; de Airtable
            </p>
          </div>
        ) : (
          Object.entries(equiposPorArea)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([area, equiposArea]) => (
              <div
                key={area}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
              >
                {/* Header de Área */}
                <button
                  onClick={() => toggleArea(area)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10">
                      <MapPin className="w-5 h-5 text-white/80" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-semibold text-white">{area}</h3>
                      <p className="text-xs text-white/50">
                        {equiposArea.length} equipo{equiposArea.length !== 1 ? "s" : ""}
                        {" · "}
                        {[...new Set(equiposArea.map((e) => e.equipo.categoria))].join(", ")}
                      </p>
                    </div>
                  </div>
                  {expandedAreas[area] ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>

                {/* Equipos del Área */}
                {expandedAreas[area] && (
                  <div className="border-t border-white/10">
                    {equiposArea.map((insp, idx) => {
                      const catConfig = CATEGORIA_CONFIG[insp.equipo.categoria] || CATEGORIA_CONFIG.Extintor;
                      const criterios = getCriteriosForCategoria(insp.equipo.categoria);

                      return (
                        <div
                          key={insp.equipoId}
                          className={`p-4 ${idx > 0 ? "border-t border-white/5" : ""} hover:bg-white/[0.03] transition-colors`}
                        >
                          {/* Equipment header */}
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg">{catConfig.icon}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-white">
                                    {insp.equipo.nombre}
                                  </p>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor} border`}
                                  >
                                    {insp.equipo.categoria}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-white/50 mt-0.5">
                                  <span>Código: {insp.equipo.codigo}</span>
                                  {insp.equipo.ubicacion && (
                                    <span>📍 {insp.equipo.ubicacion}</span>
                                  )}
                                  {insp.equipo.capacidad && (
                                    <span>📏 {insp.equipo.capacidad}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Criteria grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 mb-3">
                            {criterios.map((criterio) => (
                              <div
                                key={criterio.key}
                                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5"
                              >
                                <span className="text-[10px] text-white/50 text-center leading-tight">
                                  {criterio.shortLabel}
                                </span>
                                <CondicionSelector
                                  value={
                                    criterio.group === "comunes"
                                      ? insp.criteriosComunes[criterio.key as keyof CriteriosComunes]
                                      : criterio.group === "extintor"
                                        ? insp.criteriosExtintor[criterio.key as keyof CriteriosExtintor]
                                        : criterio.group === "botiquin"
                                          ? insp.criteriosBotiquin[criterio.key as keyof CriteriosBotiquin]
                                          : insp.criteriosCamilla[criterio.key as keyof CriteriosCamilla]
                                  }
                                  onChange={(val) =>
                                    actualizarCriterio(insp.equipoId, criterio.group, criterio.key, val)
                                  }
                                />
                              </div>
                            ))}

                            {/* Fecha vencimiento inline */}
                            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                              <span className="text-[10px] text-white/50 text-center leading-tight">
                                F. Venc.
                              </span>
                              <input
                                type="date"
                                value={insp.fechaVencimiento}
                                onChange={(e) =>
                                  actualizarFechaVencimiento(insp.equipoId, e.target.value)
                                }
                                className="w-full px-1 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-red-400/50"
                              />
                            </div>

                            {/* Observaciones inline */}
                            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5 col-span-2 sm:col-span-1 xl:col-span-2">
                              <span className="text-[10px] text-white/50 text-center leading-tight">
                                Observaciones
                              </span>
                              <input
                                type="text"
                                value={insp.observaciones}
                                onChange={(e) =>
                                  actualizarObservaciones(insp.equipoId, e.target.value)
                                }
                                placeholder="Obs..."
                                className="w-full px-2 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
        )}

        {/* Observaciones generales */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-400" />
            Observaciones Generales
          </h2>
          <textarea
            value={observacionesGenerales}
            onChange={(e) => setObservacionesGenerales(e.target.value)}
            placeholder="Observaciones generales de la inspección..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50 text-sm resize-none"
          />
        </div>

        {/* Firmas */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-400" />
            Firmas de Responsables
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {firmas.map((firma, idx) => (
              <div
                key={firma.tipo}
                className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    {firma.tipo === "Responsable" ? "Responsable SST" : "Representante COPASST"}
                  </h3>
                  {firma.firma ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-green-400">Firmado</span>
                      <button
                        onClick={() =>
                          setFirmas((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, firma: null } : f))
                          )
                        }
                        className="ml-2 p-1 rounded hover:bg-white/10 text-white/40"
                        title="Borrar firma"
                      >
                        <Eraser className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={firma.nombre}
                    onChange={(e) => actualizarFirmaData(idx, "nombre", e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={firma.cedula}
                      onChange={(e) => actualizarFirmaData(idx, "cedula", e.target.value)}
                      placeholder="Cédula"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                    />
                    <input
                      type="text"
                      value={firma.cargo}
                      onChange={(e) => actualizarFirmaData(idx, "cargo", e.target.value)}
                      placeholder="Cargo"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                    />
                  </div>
                </div>
                {!firma.firma ? (
                  <button
                    onClick={() => setFirmandoIndex(idx)}
                    disabled={!firma.nombre.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap gap-4 text-xs text-white/60">
          <span className="font-medium text-white/80">Leyenda:</span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px]">
              B
            </span>
            Bueno
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-[10px]">
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
      </main>

      {/* Modal de firma */}
      {firmandoIndex !== null && (
        <SignatureCanvas
          titulo={
            firmas[firmandoIndex].tipo === "Responsable"
              ? `Responsable SST — ${firmas[firmandoIndex].nombre}`
              : `COPASST — ${firmas[firmandoIndex].nombre}`
          }
          onConfirm={confirmarFirma}
          onCancel={() => setFirmandoIndex(null)}
        />
      )}
    </div>
  );
}
