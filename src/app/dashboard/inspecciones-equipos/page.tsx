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
  Package,
  ClipboardList,
  Link2,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Camera,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";
import { guardarEnGaleria } from "@/shared/utils";

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
type EstadoElemento = "B" | "R" | "M" | "NT" | null; // Bueno, Regular, Malo, No Tiene
type EstadoExtintor = "B" | "R" | "M" | null; // Bueno, Regular, Malo
type EstadoKit = "B" | "R" | "M" | "NT" | null; // Bueno, Regular, Malo, No Tiene
type EstadoCamilla = "B" | "R" | "M" | "NT" | null; // Bueno, Regular, Malo, No Tiene

// Elemento de botiquín inspeccionado
interface ElementoBotiquinInspeccion {
  estado: EstadoElemento;
  cantidad: string;
  fechaVencimiento: string;
}

// Criterio de extintor inspeccionado
interface CriterioExtintorInspeccion {
  estado: EstadoExtintor;
}

// Información adicional del extintor
interface InfoExtintor {
  claseAgente: string;
  tipoExtintor: string;
  capacidad: string;
  fechaProximaRecarga: string;
}

// Elemento de kit de derrames inspeccionado
interface ElementoKitInspeccion {
  estado: EstadoKit;
  cantidad: string;
  fechaVencimiento: string;
}

// Verificación del kit de derrames
interface VerificacionKitInspeccion {
  respuesta: boolean | null;
}

// Elemento de camilla inspeccionado
interface ElementoCamillaInspeccion {
  estado: EstadoCamilla;
}

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
  criteriosCamilla: CriteriosCamilla;
  // Para botiquines: inspección detallada de elementos
  elementosBotiquin: Record<string, ElementoBotiquinInspeccion>;
  // Para extintores: inspección detallada de criterios
  criteriosExtintorDetalle: Record<string, CriterioExtintorInspeccion>;
  infoExtintor: InfoExtintor;
  // Para kit de derrames: inspección detallada de elementos
  elementosKit: Record<string, ElementoKitInspeccion>;
  verificacionesKit: Record<string, VerificacionKitInspeccion>;
  // Para camillas: inspección detallada de elementos
  elementosCamilla: Record<string, ElementoCamillaInspeccion>;
  fechaVencimiento: string;
  observaciones: string;
}

interface FirmaArea {
  area: string;
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string | null;
}

// Firma global (SST y COPASST)
interface FirmaGlobal {
  tipo: "SST" | "COPASST";
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string | null;
}

type PageState = "idle" | "saving" | "success" | "error";
// ══════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════
// IMPORTANTE: Las categorías DEBEN coincidir con las opciones de Airtable (sin tildes)
const CATEGORIAS = ["Extintor", "Botiquin", "Camilla", "Kit Derrames"] as const;

const CATEGORIA_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  Extintor:        { color: "text-red-400",    bgColor: "bg-red-500/20",    borderColor: "border-red-500/30",    icon: "🧯" },
  Botiquin:        { color: "text-green-400",  bgColor: "bg-green-500/20",  borderColor: "border-green-500/30",  icon: "🩹" },
  Camilla:         { color: "text-blue-400",   bgColor: "bg-blue-500/20",   borderColor: "border-blue-500/30",   icon: "🛏️" },
  "Kit Derrames":  { color: "text-yellow-400", bgColor: "bg-yellow-500/20", borderColor: "border-yellow-500/30", icon: "⚠️" },
};

// Criterios de inspección de extintor según formato
const CRITERIOS_EXTINTOR_DETALLE: { id: string; nombre: string }[] = [
  { id: "presion", nombre: "Presión" },
  { id: "selloGarantia", nombre: "Sello de Garantía" },
  { id: "manometro", nombre: "Manómetro" },
  { id: "estadoCilindro", nombre: "Estado del Cilindro" },
  { id: "manija", nombre: "Manija" },
  { id: "boquillaManguera", nombre: "Boquilla o Manguera" },
  { id: "anilloSeguridad", nombre: "Anillo de Seguridad" },
  { id: "pinSeguridad", nombre: "Pin de Seguridad" },
  { id: "pintura", nombre: "Pintura" },
  { id: "tarjetaInspeccion", nombre: "Tarjeta de Inspección" },
];

// Elementos de botiquín según normativa
const ELEMENTOS_BOTIQUIN: { id: string; nombre: string; unidadRequerida: number }[] = [
  { id: "gasas", nombre: "Gasas", unidadRequerida: 10 },
  { id: "esparadrapo", nombre: "Esparadrapo", unidadRequerida: 1 },
  { id: "bajalenguas", nombre: "Bajalenguas", unidadRequerida: 10 },
  { id: "guantesLatex", nombre: "Guantes de latex", unidadRequerida: 5 },
  { id: "aplicadores", nombre: "Aplicadores o copitos", unidadRequerida: 1 },
  { id: "vendaElastica2x5", nombre: "Venda elástica 2X5 Yardas", unidadRequerida: 1 },
  { id: "vendaElastica3x5", nombre: "Venda elástica 3X5 Yardas", unidadRequerida: 1 },
  { id: "vendaElastica5x5", nombre: "Venda elástica 5X5 Yardas", unidadRequerida: 1 },
  { id: "vendaAlgodon3x5", nombre: "Venda de algodón 3X5 Yardas", unidadRequerida: 1 },
  { id: "vendaAlgodon5x5", nombre: "Venda de algodón 5X5 Yardas", unidadRequerida: 1 },
  { id: "yodopovidona", nombre: "Yodopovidona (Jabón quirúrgico)", unidadRequerida: 1 },
  { id: "solucionSalina", nombre: "Solución salina 250 cc ó 500 cc", unidadRequerida: 1 },
  { id: "tapabocas", nombre: "Tapabocas", unidadRequerida: 3 },
  { id: "alcoholAntiseptico", nombre: "Alcohol antiséptico frasco por 275 ml", unidadRequerida: 1 },
  { id: "curas", nombre: "Curas", unidadRequerida: 5 },
  { id: "jeringa5ml", nombre: "Jeringa de 5 ml", unidadRequerida: 1 },
  { id: "tijerasTrauma", nombre: "Tijeras de Trauma", unidadRequerida: 1 },
  { id: "parcheOcular", nombre: "Parche Ocular", unidadRequerida: 3 },
  { id: "termometro", nombre: "Termómetro", unidadRequerida: 1 },
  { id: "libreta", nombre: "Libreta", unidadRequerida: 1 },
  { id: "lapicero", nombre: "Lapicero", unidadRequerida: 1 },
  { id: "manualEmergencia", nombre: "Manual de emergencia", unidadRequerida: 1 },
];

// Elementos de kit de derrames según formato
const ELEMENTOS_KIT_DERRAMES: { id: string; nombre: string; unidadRequerida: number }[] = [
  { id: "panosAbsorventes", nombre: "Paños Absorventes", unidadRequerida: 4 },
  { id: "barreraAbsorvente", nombre: "Barrera Absorvente", unidadRequerida: 2 },
  { id: "trajeDesechable", nombre: "Traje Desechable", unidadRequerida: 1 },
  { id: "bolsaRoja", nombre: "Bolsa Roja para Recoger Residuos Contaminados", unidadRequerida: 2 },
  { id: "palaPlastica", nombre: "Pala Plástica", unidadRequerida: 1 },
  { id: "espatulaPlastica", nombre: "Espátula Plástica", unidadRequerida: 1 },
  { id: "guantesNitrilo", nombre: "Guantes de Nitrilo", unidadRequerida: 1 },
  { id: "gafasSeguridad", nombre: "Gafas Transparentes de Seguridad", unidadRequerida: 1 },
  { id: "cintaPeligro", nombre: "Cinta de Peligro", unidadRequerida: 1 },
  { id: "martilloGoma", nombre: "Martillo de Goma", unidadRequerida: 1 },
  { id: "recogedorMano", nombre: "Recogedor de Mano Plástico", unidadRequerida: 1 },
  { id: "respiradorN95", nombre: "Respirador un Cartucho o Tapabocas N-95", unidadRequerida: 1 },
  { id: "linternaRecargable", nombre: "Linterna Recargable", unidadRequerida: 1 },
  { id: "bolsaGranulado", nombre: "Bolsa Granulado Absorbente", unidadRequerida: 1 },
  { id: "masillaEpoxica", nombre: "Masilla Epóxica", unidadRequerida: 1 },
  { id: "desengrasante", nombre: "Desengrasante Biodegradable", unidadRequerida: 1 },
  { id: "chalecoReflectivo", nombre: "Chaleco Antireflectivo", unidadRequerida: 1 },
  { id: "conos", nombre: "Conos", unidadRequerida: 1 },
];

// Verificaciones del kit de derrames
const VERIFICACIONES_KIT: { id: string; pregunta: string }[] = [
  { id: "conoceProcedimiento", pregunta: "¿El responsable del kit control de derrame conoce el procedimiento para usarlo?" },
  { id: "lugarAdecuado", pregunta: "¿El kit se encuentra almacenado en un lugar seco y protegido de agentes contaminantes?" },
  { id: "rotulado", pregunta: "¿La caneca o morral donde se guarda el kit se encuentra rotulado o señalizado?" },
];

// Elementos de camilla según formato
const ELEMENTOS_CAMILLA: { id: string; nombre: string; unidadRequerida: number }[] = [
  { id: "estadoPasta", nombre: "Estado de la Pasta", unidadRequerida: 1 },
  { id: "correasSeguridad", nombre: "Correas de Seguridad", unidadRequerida: 3 },
  { id: "sujetadoresCargue", nombre: "Sujetadores para Cargue", unidadRequerida: 2 },
  { id: "crucetasSeguridad", nombre: "Crucetas de Seguridad", unidadRequerida: 2 },
  { id: "inmovilizadorSuperior", nombre: "Estado de Inmovilizador Superior", unidadRequerida: 1 },
  { id: "inmovilizadorInferior", nombre: "Estado de Inmovilizador Inferior", unidadRequerida: 1 },
  { id: "estadoGeneralCamilla", nombre: "Estado General de la Camilla", unidadRequerida: 1 },
];

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

const CRITERIOS_CAMILLA_LABELS: { key: string; label: string; shortLabel: string }[] = [
  { key: "estructura",   label: "Estructura",      shortLabel: "Estruct." },
  { key: "correasArnes", label: "Correas / Arnés", shortLabel: "Correas" },
];

const CONDICION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bueno: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  Malo:  { bg: "bg-red-100",   text: "text-red-700",   border: "border-red-300"   },
  NA:    { bg: "bg-gray-100",  text: "text-gray-500",  border: "border-gray-300"  },
};

const ESTADO_ELEMENTO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  B:  { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  R:  { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
  M:  { bg: "bg-red-100",   text: "text-red-700",   border: "border-red-300"   },
  NT: { bg: "bg-gray-100",  text: "text-gray-500",  border: "border-gray-300"  },
};

// ══════════════════════════════════════════════════════════
// Borrador persistente (localStorage)
// ══════════════════════════════════════════════════════════
const BORRADOR_KEY = "inspeccion_equipos_borrador";
const BORRADOR_VERSION = 1;

type InspeccionDataGuardada = {
  criteriosComunes: CriteriosComunes;
  criteriosExtintor: CriteriosExtintor;
  criteriosCamilla: CriteriosCamilla;
  elementosBotiquin: Record<string, ElementoBotiquinInspeccion>;
  criteriosExtintorDetalle: Record<string, CriterioExtintorInspeccion>;
  infoExtintor: InfoExtintor;
  elementosKit: Record<string, ElementoKitInspeccion>;
  verificacionesKit: Record<string, VerificacionKitInspeccion>;
  elementosCamilla: Record<string, ElementoCamillaInspeccion>;
  fechaVencimiento: string;
  observaciones: string;
};

interface FotoGuardada {
  dataUrl: string;
  name: string;
  type: string;
}

interface BorradorData {
  version: number;
  savedAt: string;
  fechaInspeccion: string;
  inspector: string;
  inspeccionesData: Record<string, InspeccionDataGuardada>;
  firmasAreas: FirmaArea[];
  firmaSST: FirmaGlobal;
  firmaCOPASST: FirmaGlobal;
  areasGuardadas: string[];
  fotosBase64?: Record<string, FotoGuardada>;
}

function leerBorrador(): BorradorData | null {
  try {
    const raw = localStorage.getItem(BORRADOR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BorradorData;
    if (data.version !== BORRADOR_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

function guardarBorrador(data: BorradorData): void {
  try {
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(data));
  } catch {
    // Cuota de localStorage excedida — ignorar silenciosamente
  }
}

function eliminarBorrador(): void {
  try {
    localStorage.removeItem(BORRADOR_KEY);
  } catch {
    // ignorar
  }
}

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
    case "Camilla":
      CRITERIOS_CAMILLA_LABELS.forEach((c) =>
        criterios.push({ ...c, group: "camilla" })
      );
      break;
    case "Kit Derrames":
      criterios.push({ key: "completitudElementos", label: "Completitud Elementos", shortLabel: "Complet.", group: "kit" });
      criterios.push({ key: "estadoContenedor", label: "Estado Contenedor", shortLabel: "Conten.", group: "kit" });
      break;
  }
  return criterios;
}

function createEmptyElementosBotiquin(): Record<string, ElementoBotiquinInspeccion> {
  const elementos: Record<string, ElementoBotiquinInspeccion> = {};
  ELEMENTOS_BOTIQUIN.forEach((el) => {
    elementos[el.id] = { estado: null, cantidad: "", fechaVencimiento: "" };
  });
  return elementos;
}

function createEmptyCriteriosExtintor(): Record<string, CriterioExtintorInspeccion> {
  const criterios: Record<string, CriterioExtintorInspeccion> = {};
  CRITERIOS_EXTINTOR_DETALLE.forEach((c) => {
    criterios[c.id] = { estado: null };
  });
  return criterios;
}

function createEmptyInfoExtintor(): InfoExtintor {
  return {
    claseAgente: "",
    tipoExtintor: "",
    capacidad: "",
    fechaProximaRecarga: "",
  };
}

function createEmptyElementosKit(): Record<string, ElementoKitInspeccion> {
  const elementos: Record<string, ElementoKitInspeccion> = {};
  ELEMENTOS_KIT_DERRAMES.forEach((el) => {
    elementos[el.id] = { estado: null, cantidad: "", fechaVencimiento: "" };
  });
  return elementos;
}

function createEmptyVerificacionesKit(): Record<string, VerificacionKitInspeccion> {
  const verificaciones: Record<string, VerificacionKitInspeccion> = {};
  VERIFICACIONES_KIT.forEach((v) => {
    verificaciones[v.id] = { respuesta: null };
  });
  return verificaciones;
}

function createEmptyElementosCamilla(): Record<string, ElementoCamillaInspeccion> {
  const elementos: Record<string, ElementoCamillaInspeccion> = {};
  ELEMENTOS_CAMILLA.forEach((el) => {
    elementos[el.id] = { estado: null };
  });
  return elementos;
}

function createEmptyInspeccion(equipo: EquipoItem): InspeccionEquipo {
  return {
    equipoId: equipo.id,
    equipo,
    criteriosComunes: { estadoGeneral: null, senalizacion: null, accesibilidad: null },
    criteriosExtintor: { presionManometro: null, manguera: null, pinSeguridad: null, soporteBase: null },
    criteriosCamilla: { estructura: null, correasArnes: null },
    elementosBotiquin: createEmptyElementosBotiquin(),
    criteriosExtintorDetalle: createEmptyCriteriosExtintor(),
    infoExtintor: createEmptyInfoExtintor(),
    elementosKit: createEmptyElementosKit(),
    verificacionesKit: createEmptyVerificacionesKit(),
    elementosCamilla: createEmptyElementosCamilla(),
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
// Componente Selector de Condición para equipos
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
// Componente Selector de Estado para elementos de botiquín
// ══════════════════════════════════════════════════════════
function EstadoElementoSelector({
  value,
  onChange,
}: {
  value: EstadoElemento;
  onChange: (val: EstadoElemento) => void;
}) {
  const opciones: { val: EstadoElemento; label: string }[] = [
    { val: "B",  label: "B" },
    { val: "R",  label: "R" },
    { val: "M",  label: "M" },
    { val: "NT", label: "NT" },
  ];

  return (
    <div className="flex gap-0.5 justify-center">
      {opciones.map((op) => {
        const isSelected = value === op.val;
        const colors = op.val ? ESTADO_ELEMENTO_COLORS[op.val] : null;

        return (
          <button
            key={op.val}
            onClick={() => onChange(isSelected ? null : op.val)}
            className={`
              w-6 h-5 rounded text-[9px] font-bold transition-all cursor-pointer
              ${
                isSelected && colors
                  ? `${colors.bg} ${colors.text} ${colors.border} border`
                  : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60"
              }
            `}
            title={op.val === "NT" ? "No Tiene" : op.label}
          >
            {op.label}
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
  const [inspecciones, setInspecciones] = useState<InspeccionEquipo[]>([]);

  // Fotos de evidencia por equipo (equipoId → File)
  const [fotosEquipo, setFotosEquipo] = useState<Record<string, File>>({});
  const [fotosPreviewEquipo, setFotosPreviewEquipo] = useState<Record<string, string>>({});
  // Versión base64 de las fotos para persistencia en borrador
  const [fotosBase64, setFotosBase64] = useState<Record<string, FotoGuardada>>({});

  // Equipos
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("Todas");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [areas, setAreas] = useState<string[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [expandedBotiquines, setExpandedBotiquines] = useState<Record<string, boolean>>({});
  const [expandedExtintores, setExpandedExtintores] = useState<Record<string, boolean>>({});
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const [expandedCamillas, setExpandedCamillas] = useState<Record<string, boolean>>({});

  // Firmas por área
  const [firmasAreas, setFirmasAreas] = useState<FirmaArea[]>([]);
  const [firmandoArea, setFirmandoArea] = useState<string | null>(null);

  // Estado para rastrear áreas guardadas y guardando
  const [areasGuardadas, setAreasGuardadas] = useState<Set<string>>(new Set());
  const [guardandoArea, setGuardandoArea] = useState<string | null>(null);

  // Estados para enlaces de firma remota
  const [enlacesFirma, setEnlacesFirma] = useState<Record<string, string>>({});
  const [generandoEnlace, setGenerandoEnlace] = useState<string | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState<string | null>(null);
  const [verificandoFirma, setVerificandoFirma] = useState<string | null>(null);
  const [firmasRemotas, setFirmasRemotas] = useState<Record<string, boolean>>({}); // área -> firmado

  // Estados para modal de edición/creación de equipos
  const [modalEquipoAbierto, setModalEquipoAbierto] = useState(false);
  const [equipoEditando, setEquipoEditando] = useState<EquipoItem | null>(null);
  const [guardandoEquipo, setGuardandoEquipo] = useState(false);
  const [areaParaNuevoEquipo, setAreaParaNuevoEquipo] = useState<string | null>(null);
  const [formEquipo, setFormEquipo] = useState<Partial<EquipoItem>>({
    codigo: "",
    nombre: "",
    categoria: "Extintor",
    tipoEspecifico: "",
    area: "",
    ubicacion: "",
    capacidad: "",
    fechaVencimiento: null,
    estado: "Activo",
    descripcion: "",
  });

  // Firmas globales (Responsable SST y COPASST)
  const [firmaSST, setFirmaSST] = useState<FirmaGlobal>({
    tipo: "SST",
    nombre: "",
    cedula: "",
    cargo: "",
    firma: null,
  });
  const [firmaCOPASST, setFirmaCOPASST] = useState<FirmaGlobal>({
    tipo: "COPASST",
    nombre: "",
    cedula: "",
    cargo: "",
    firma: null,
  });
  const [firmandoGlobal, setFirmandoGlobal] = useState<"SST" | "COPASST" | null>(null);

  // Borrador persistente
  const cargaInicialLista = useRef(false); // true tras la primera carga de equipos
  const [borradorGuardadoEn, setBorradorGuardadoEn] = useState<Date | null>(null);
  const borradorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsables SST (miembros del comité COPASST + Responsables SG-SST)
  const [responsablesSST, setResponsablesSST] = useState<{ id: string; nombre: string; cedula: string; cargo: string }[]>([]);
  const [cargandoResponsablesSST, setCargandoResponsablesSST] = useState(true);

  // Todos los empleados para dropdown de Responsable de Área
  interface EmpleadoArea {
    id: string;
    nombreCompleto: string;
    numeroDocumento: string;
    cargo: string;
  }
  const [todosLosEmpleados, setTodosLosEmpleados] = useState<EmpleadoArea[]>([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);

  // Cargar responsables SST (miembros del comité)
  useEffect(() => {
    async function fetchResponsablesSST() {
      try {
        const res = await fetch("/api/inspecciones-areas?responsables=true");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.responsables)) {
            setResponsablesSST(data.responsables);
          }
        }
      } catch (err) {
        console.error("Error cargando responsables SST:", err);
      } finally {
        setCargandoResponsablesSST(false);
      }
    }
    fetchResponsablesSST();
  }, []);

  // Función para cargar todos los empleados (para Responsable de Área)
  const cargarTodosLosEmpleados = useCallback(async () => {
    if (todosLosEmpleados.length > 0 || cargandoEmpleados) return;
    setCargandoEmpleados(true);
    try {
      const res = await fetch("/api/personal");
      const json = await res.json();
      if (json.success && json.data) {
        setTodosLosEmpleados(
          json.data.map((e: { id: string; nombreCompleto: string; numeroDocumento: string; tipoPersonal: string }) => ({
            id: e.id,
            nombreCompleto: e.nombreCompleto,
            numeroDocumento: e.numeroDocumento,
            cargo: e.tipoPersonal || "",
          }))
        );
      }
    } catch (err) {
      console.error("Error cargando empleados:", err);
    } finally {
      setCargandoEmpleados(false);
    }
  }, [todosLosEmpleados.length, cargandoEmpleados]);

  // Cargar equipos al iniciar
  const fetchEquipos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipos-emergencia");
      const json = await res.json();
      if (json.success && json.data) {
        // Normalizar categorías: el catálogo usa tildes, pero necesitamos sin tildes
        const CATEGORIA_NORMALIZE: Record<string, string> = {
          "Botiquín": "Botiquin",
          "Botiquin": "Botiquin",
        };
        
        const equipos: EquipoItem[] = json.data.map((e: EquipoItem) => ({
          ...e,
          categoria: CATEGORIA_NORMALIZE[e.categoria] || e.categoria,
        }));
        const inspeccionesIniciales = equipos.map(createEmptyInspeccion);

        // Restaurar borrador si existe
        const borrador = leerBorrador();
        if (borrador) {
          // Aplicar datos guardados sobre las inspecciones iniciales
          const inspeccionesConBorrador = inspeccionesIniciales.map((insp) => {
            const guardado = borrador.inspeccionesData[insp.equipoId];
            if (!guardado) return insp;
            return {
              ...insp,
              criteriosComunes: guardado.criteriosComunes,
              criteriosExtintor: guardado.criteriosExtintor,
              criteriosCamilla: guardado.criteriosCamilla,
              elementosBotiquin: guardado.elementosBotiquin,
              criteriosExtintorDetalle: guardado.criteriosExtintorDetalle,
              infoExtintor: guardado.infoExtintor,
              elementosKit: guardado.elementosKit,
              verificacionesKit: guardado.verificacionesKit,
              elementosCamilla: guardado.elementosCamilla,
              fechaVencimiento: guardado.fechaVencimiento,
              observaciones: guardado.observaciones,
            };
          });
          setInspecciones(inspeccionesConBorrador);
          if (borrador.fechaInspeccion) setFechaInspeccion(borrador.fechaInspeccion);
          if (borrador.inspector) setInspector(borrador.inspector);
          if (borrador.areasGuardadas?.length) {
            setAreasGuardadas(new Set(borrador.areasGuardadas));
          }
        } else {
          setInspecciones(inspeccionesIniciales);
        }

        // Extraer áreas únicas
        const areasUnicas = [...new Set(equipos.map((e) => e.area))].filter(Boolean).sort();
        setAreas(areasUnicas);

        // Expandir todas las áreas por defecto
        const expanded: Record<string, boolean> = {};
        areasUnicas.forEach((a) => (expanded[a] = true));
        setExpandedAreas(expanded);

        // Inicializar firmas por área (restaurando desde borrador si hay)
        const firmasInit: FirmaArea[] = areasUnicas.map((a) => {
          const firmaGuardada = borrador?.firmasAreas?.find((f) => f.area === a);
          return firmaGuardada ?? { area: a, nombre: "", cedula: "", cargo: "", firma: null };
        });
        setFirmasAreas(firmasInit);

        // Restaurar firmas globales desde borrador
        if (borrador?.firmaSST) setFirmaSST(borrador.firmaSST);
        if (borrador?.firmaCOPASST) setFirmaCOPASST(borrador.firmaCOPASST);

        // Restaurar fotos desde borrador
        if (borrador?.fotosBase64 && Object.keys(borrador.fotosBase64).length > 0) {
          // Usar los dataUrls directamente como preview (son válidos en <img src>)
          setFotosPreviewEquipo(
            Object.fromEntries(
              Object.entries(borrador.fotosBase64).map(([id, f]) => [id, f.dataUrl])
            )
          );
          // Reconstruir File objects desde base64 para poder subirlos a S3
          const fileEntries = await Promise.all(
            Object.entries(borrador.fotosBase64).map(async ([id, f]) => {
              try {
                const resp = await fetch(f.dataUrl);
                const blob = await resp.blob();
                const file = new File([blob], f.name, { type: f.type });
                return [id, file] as [string, File];
              } catch {
                return null;
              }
            })
          );
          const filesMap: Record<string, File> = {};
          fileEntries.forEach((entry) => { if (entry) filesMap[entry[0]] = entry[1]; });
          setFotosEquipo(filesMap);
          setFotosBase64(borrador.fotosBase64);
        }

        // Marcar carga inicial como lista para habilitar el guardado automático
        cargaInicialLista.current = true;
        if (borrador) setBorradorGuardadoEn(new Date(borrador.savedAt));
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

  // Guardar borrador automáticamente con debounce de 1.5 s
  useEffect(() => {
    if (!cargaInicialLista.current) return;
    if (borradorTimer.current) clearTimeout(borradorTimer.current);
    borradorTimer.current = setTimeout(() => {
      const inspeccionesData: Record<string, InspeccionDataGuardada> = {};
      inspecciones.forEach((i) => {
        inspeccionesData[i.equipoId] = {
          criteriosComunes: i.criteriosComunes,
          criteriosExtintor: i.criteriosExtintor,
          criteriosCamilla: i.criteriosCamilla,
          elementosBotiquin: i.elementosBotiquin,
          criteriosExtintorDetalle: i.criteriosExtintorDetalle,
          infoExtintor: i.infoExtintor,
          elementosKit: i.elementosKit,
          verificacionesKit: i.verificacionesKit,
          elementosCamilla: i.elementosCamilla,
          fechaVencimiento: i.fechaVencimiento,
          observaciones: i.observaciones,
        };
      });
      const data: BorradorData = {
        version: BORRADOR_VERSION,
        savedAt: new Date().toISOString(),
        fechaInspeccion,
        inspector,
        inspeccionesData,
        firmasAreas,
        firmaSST,
        firmaCOPASST,
        areasGuardadas: [...areasGuardadas],
        fotosBase64,
      };
      guardarBorrador(data);
      setBorradorGuardadoEn(new Date());
    }, 1500);
    return () => {
      if (borradorTimer.current) clearTimeout(borradorTimer.current);
    };
  }, [inspecciones, firmasAreas, firmaSST, firmaCOPASST, fechaInspeccion, inspector, areasGuardadas, fotosBase64]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar borrador y reiniciar formulario
  const limpiarBorrador = useCallback(() => {
    eliminarBorrador();
    setBorradorGuardadoEn(null);
    setFotosEquipo({});
    setFotosPreviewEquipo({});
    setFotosBase64({});
    cargaInicialLista.current = false;
    fetchEquipos();
  }, [fetchEquipos]);

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

  // Cargar todos los empleados al inicio
  useEffect(() => {
    cargarTodosLosEmpleados();
  }, [cargarTodosLosEmpleados]);

  // Toggle botiquín expandido
  const toggleBotiquin = (equipoId: string) => {
    setExpandedBotiquines((prev) => ({ ...prev, [equipoId]: !prev[equipoId] }));
  };

  // Toggle extintor expandido
  const toggleExtintor = (equipoId: string) => {
    setExpandedExtintores((prev) => ({ ...prev, [equipoId]: !prev[equipoId] }));
  };

  // Toggle kit de derrames expandido
  const toggleKit = (equipoId: string) => {
    setExpandedKits((prev) => ({ ...prev, [equipoId]: !prev[equipoId] }));
  };

  // Toggle camilla expandida
  const toggleCamilla = (equipoId: string) => {
    setExpandedCamillas((prev) => ({ ...prev, [equipoId]: !prev[equipoId] }));
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
          case "camilla":
            updated.criteriosCamilla = { ...i.criteriosCamilla, [key]: value };
            break;
        }
        return updated;
      })
    );
  };

  // Actualizar elemento de botiquín
  const actualizarElementoBotiquin = (
    equipoId: string,
    elementoId: string,
    field: keyof ElementoBotiquinInspeccion,
    value: EstadoElemento | string
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          elementosBotiquin: {
            ...i.elementosBotiquin,
            [elementoId]: {
              ...i.elementosBotiquin[elementoId],
              [field]: value,
            },
          },
        };
      })
    );
  };

  // Actualizar criterio de extintor detallado
  const actualizarCriterioExtintor = (
    equipoId: string,
    criterioId: string,
    estado: EstadoExtintor
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          criteriosExtintorDetalle: {
            ...i.criteriosExtintorDetalle,
            [criterioId]: { estado },
          },
        };
      })
    );
  };

  // Actualizar información adicional del extintor
  const actualizarInfoExtintor = (
    equipoId: string,
    field: keyof InfoExtintor,
    value: string
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          infoExtintor: {
            ...i.infoExtintor,
            [field]: value,
          },
        };
      })
    );
  };

  // Actualizar elemento del kit de derrames
  const actualizarElementoKit = (
    equipoId: string,
    elementoId: string,
    field: "estado" | "cantidad" | "fechaVencimiento",
    value: EstadoKit | string
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          elementosKit: {
            ...i.elementosKit,
            [elementoId]: {
              ...i.elementosKit[elementoId],
              [field]: value,
            },
          },
        };
      })
    );
  };

  // Actualizar verificación del kit de derrames
  const actualizarVerificacionKit = (
    equipoId: string,
    verificacionId: string,
    value: boolean
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          verificacionesKit: {
            ...i.verificacionesKit,
            [verificacionId]: { respuesta: value },
          },
        };
      })
    );
  };

  // Actualizar elemento de camilla
  const actualizarElementoCamilla = (
    equipoId: string,
    elementoId: string,
    value: EstadoCamilla
  ) => {
    setInspecciones((prev) =>
      prev.map((i) => {
        if (i.equipoId !== equipoId) return i;
        return {
          ...i,
          elementosCamilla: {
            ...i.elementosCamilla,
            [elementoId]: { estado: value },
          },
        };
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

  // Firmas por área
  const actualizarFirmaArea = (area: string, field: keyof FirmaArea, value: string) => {
    setFirmasAreas((prev) =>
      prev.map((f) => (f.area === area ? { ...f, [field]: value } : f))
    );
  };

  const confirmarFirmaArea = (dataUrl: string) => {
    if (firmandoArea === null) return;
    setFirmasAreas((prev) =>
      prev.map((f) => (f.area === firmandoArea ? { ...f, firma: dataUrl } : f))
    );
    setFirmandoArea(null);
  };

  const confirmarFirmaGlobal = (dataUrl: string) => {
    if (firmandoGlobal === "SST") {
      setFirmaSST((prev) => ({ ...prev, firma: dataUrl }));
    } else if (firmandoGlobal === "COPASST") {
      setFirmaCOPASST((prev) => ({ ...prev, firma: dataUrl }));
    }
    setFirmandoGlobal(null);
  };

  // Verificar si un equipo está completamente inspeccionado
  const equipoInspeccionado = (insp: InspeccionEquipo): boolean => {
    if (insp.equipo.categoria === "Botiquin") {
      // Verificar que todos los elementos tengan estado
      return ELEMENTOS_BOTIQUIN.every((el) => insp.elementosBotiquin[el.id]?.estado !== null);
    }
    if (insp.equipo.categoria === "Extintor") {
      // Verificar que todos los criterios detallados tengan estado
      return CRITERIOS_EXTINTOR_DETALLE.every((c) => insp.criteriosExtintorDetalle[c.id]?.estado !== null);
    }
    if (insp.equipo.categoria === "Kit Derrames") {
      // Verificar que todos los elementos y verificaciones tengan respuesta
      const elementosCompletos = ELEMENTOS_KIT_DERRAMES.every((el) => insp.elementosKit[el.id]?.estado !== null);
      const verificacionesCompletas = VERIFICACIONES_KIT.every((v) => insp.verificacionesKit[v.id]?.respuesta !== null);
      return elementosCompletos && verificacionesCompletas;
    }
    if (insp.equipo.categoria === "Camilla") {
      // Verificar que todos los elementos de camilla tengan estado
      return ELEMENTOS_CAMILLA.every((el) => insp.elementosCamilla[el.id]?.estado !== null);
    }
    // Para otros equipos, verificar criterios
    const criterios = getCriteriosForCategoria(insp.equipo.categoria);
    return criterios.every((c) => {
      if (c.group === "comunes") return insp.criteriosComunes[c.key] !== null;
      if (c.group === "extintor") return insp.criteriosExtintor[c.key] !== null;
      if (c.group === "camilla") return insp.criteriosCamilla[c.key] !== null;
      return true;
    });
  };

  // Estadísticas
  const totalEquipos = inspecciones.length;
  const equiposInspeccionados = inspecciones.filter(equipoInspeccionado).length;
  const todosInspeccionados = equiposInspeccionados === totalEquipos && totalEquipos > 0;
  const firmasAreasCompletas = firmasAreas.filter((f) => f.firma !== null).length;
  const firmasGlobalesCompletas = (firmaSST.firma !== null ? 1 : 0) + (firmaCOPASST.firma !== null ? 1 : 0);
  const todasLasFirmas = 
    firmasAreasCompletas === firmasAreas.length && 
    firmasAreas.length > 0 && 
    firmaSST.firma !== null && 
    firmaCOPASST.firma !== null;

  // Estadísticas por área
  const getEstadisticasArea = (area: string) => {
    const equiposArea = inspecciones.filter((i) => i.equipo.area === area);
    const equiposInspeccionadosArea = equiposArea.filter(equipoInspeccionado).length;
    const firmaArea = firmasAreas.find((f) => f.area === area);
    const firmaCompleta = firmaArea?.firma !== null && firmaArea?.nombre.trim() !== "";
    const todosInspeccionadosArea = equiposInspeccionadosArea === equiposArea.length && equiposArea.length > 0;
    const areaYaGuardada = areasGuardadas.has(area);
    
    return {
      total: equiposArea.length,
      inspeccionados: equiposInspeccionadosArea,
      todosInspeccionados: todosInspeccionadosArea,
      firmaCompleta,
      puedeGuardar: todosInspeccionadosArea && firmaCompleta && !areaYaGuardada,
      yaGuardada: areaYaGuardada,
    };
  };

  // Guardar inspección por área específica
  const guardarInspeccionPorArea = async (area: string) => {
    // Validar firmas SST y COPASST obligatorias
    const firmasFaltantes: string[] = [];
    if (!firmaSST.firma) firmasFaltantes.push("Responsable SST");
    if (!firmaCOPASST.firma) firmasFaltantes.push("Miembro COPASST");
    
    if (firmasFaltantes.length > 0) {
      setErrorMessage(`Antes de guardar debe completar las firmas de: ${firmasFaltantes.join(" y ")}.`);
      return;
    }

    const stats = getEstadisticasArea(area);
    
    if (!stats.todosInspeccionados) {
      setErrorMessage(`Debe inspeccionar todos los equipos del área "${area}". Faltan ${stats.total - stats.inspeccionados} equipos.`);
      return;
    }

    if (!stats.firmaCompleta) {
      setErrorMessage(`Falta la firma del responsable del área "${area}".`);
      return;
    }

    if (stats.yaGuardada) {
      setErrorMessage(`El área "${area}" ya fue guardada.`);
      return;
    }

    setGuardandoArea(area);
    setErrorMessage(null);

    try {
      // Helper para convertir estados detallados (B/R/M/NT) a estados simples (Bueno/Malo/NA)
      const mapEstadoDetallado = (estado: string | null | undefined): "Bueno" | "Malo" | "NA" | null => {
        if (estado === null || estado === undefined) return null;
        if (estado === "B") return "Bueno";
        if (estado === "R" || estado === "M") return "Malo";
        if (estado === "NT") return "NA";
        return null;
      };

      // Helper para calcular estado general de elementos
      const calcularEstadoGeneral = (
        elementos: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!elementos) return "NA";
        const estados = Object.values(elementos).map((e) => e.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      // Helper para calcular estado general de criterios de extintor
      const calcularEstadoExtintor = (
        criterios: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!criterios) return "NA";
        const estados = Object.values(criterios).map((c) => c.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      // Filtrar solo equipos del área
      const inspeccionesArea = inspecciones.filter((i) => i.equipo.area === area);
      
      const detalles = inspeccionesArea.map((i) => {
        const isExtintor = i.equipo.categoria === "Extintor";
        const isBotiquin = i.equipo.categoria === "Botiquin";
        const isCamilla = i.equipo.categoria === "Camilla";
        const isKit = i.equipo.categoria === "Kit Derrames";

        let estadoGeneral = i.criteriosComunes.estadoGeneral;
        let senalizacion = i.criteriosComunes.senalizacion;
        let accesibilidad = i.criteriosComunes.accesibilidad;

        if (isExtintor && !estadoGeneral) {
          estadoGeneral = calcularEstadoExtintor(i.criteriosExtintorDetalle);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isBotiquin && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isCamilla && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosCamilla as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isKit && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        }

        return {
          equipoRecordId: i.equipoId,
          codigoEquipo: i.equipo.codigo,
          nombreEquipo: i.equipo.nombre,
          categoria: i.equipo.categoria,
          area: i.equipo.area,
          estadoGeneral,
          senalizacion,
          accesibilidad,
          presionManometro: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.presion?.estado)
            : i.criteriosExtintor.presionManometro,
          manguera: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.boquillaManguera?.estado)
            : i.criteriosExtintor.manguera,
          pinSeguridad: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.pinSeguridad?.estado)
            : i.criteriosExtintor.pinSeguridad,
          soporteBase: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.selloGarantia?.estado)
            : i.criteriosExtintor.soporteBase,
          estructura: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.estructura?.estado)
            : i.criteriosCamilla.estructura,
          correasArnes: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.correasArnes?.estado)
            : i.criteriosCamilla.correasArnes,
          completitudElementos: isBotiquin
            ? calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>)
            : (isKit ? calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>) : null),
          estadoContenedor: isBotiquin || isKit ? "Bueno" : null,
          criteriosExtintorDetalle: isExtintor ? i.criteriosExtintorDetalle : null,
          elementosBotiquin: isBotiquin ? i.elementosBotiquin : null,
          elementosKit: isKit ? i.elementosKit : null,
          verificacionesKit: isKit ? i.verificacionesKit : null,
          elementosCamilla: isCamilla ? i.elementosCamilla : null,
          infoExtintor: isExtintor ? i.infoExtintor : null,
          fechaVencimiento: i.fechaVencimiento || null,
          observaciones: i.observaciones,
        };
      });

      // Solo incluir la firma del responsable de esta área + firmas globales
      const firmaArea = firmasAreas.find((f) => f.area === area);
      const responsables = [];
      
      // Agregar firma del responsable de área
      if (firmaArea && firmaArea.firma && firmaArea.nombre.trim()) {
        responsables.push({
          tipo: "Responsable Área",
          area: firmaArea.area,
          nombre: firmaArea.nombre,
          cedula: firmaArea.cedula,
          cargo: firmaArea.cargo,
          firma: firmaArea.firma,
        });
      }

      // Agregar firma SST (obligatoria, ya validada arriba)
      if (firmaSST.firma) {
        responsables.push({
          tipo: "Responsable SST",
          area: area,
          nombre: firmaSST.nombre,
          cedula: firmaSST.cedula,
          cargo: firmaSST.cargo,
          firma: firmaSST.firma,
        });
      }

      // Agregar firma COPASST (obligatoria, ya validada arriba)
      if (firmaCOPASST.firma) {
        responsables.push({
          tipo: "Vigía COPASST",
          area: area,
          nombre: firmaCOPASST.nombre,
          cedula: firmaCOPASST.cedula,
          cargo: firmaCOPASST.cargo,
          firma: firmaCOPASST.firma,
        });
      }

      const payload = {
        fechaInspeccion,
        inspector,
        observacionesGenerales: `Inspección parcial - Área: ${area}`,
        detalles,
        responsables,
        areaParcial: area, // Indicador de que es una inspección parcial por área
      };

      const res = await fetch("/api/inspecciones-equipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        // Marcar el área como guardada
        const nuevasAreasGuardadas = new Set([...areasGuardadas, area]);
        setAreasGuardadas(nuevasAreasGuardadas);
        setErrorMessage(null);
        // Si todas las áreas están guardadas, limpiar el borrador
        if (nuevasAreasGuardadas.size >= areas.length && areas.length > 0) {
          eliminarBorrador();
          setBorradorGuardadoEn(null);
        }
        // Mostrar mensaje de éxito temporal
        setPageState("success");
        setTimeout(() => setPageState("idle"), 3000);
      } else {
        throw new Error(json.message || "Error al guardar la inspección del área");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGuardandoArea(null);
    }
  };

  // Generar enlace de firma remota para un área
  const generarEnlaceFirma = async (area: string) => {
    // Validar firmas SST y COPASST obligatorias
    const firmasFaltantes: string[] = [];
    if (!firmaSST.firma) firmasFaltantes.push("Responsable SST");
    if (!firmaCOPASST.firma) firmasFaltantes.push("Miembro COPASST");
    
    if (firmasFaltantes.length > 0) {
      setErrorMessage(`Antes de generar el enlace debe completar las firmas de: ${firmasFaltantes.join(" y ")}.`);
      return;
    }

    const stats = getEstadisticasArea(area);
    
    if (!stats.todosInspeccionados) {
      setErrorMessage(`Debe inspeccionar todos los equipos del área "${area}" antes de generar el enlace.`);
      return;
    }

    const firmaArea = firmasAreas.find((f) => f.area === area);
    if (!firmaArea || !firmaArea.nombre.trim() || !firmaArea.cedula.trim()) {
      setErrorMessage(`Debe seleccionar un responsable para el área "${area}" antes de generar el enlace.`);
      return;
    }

    setGenerandoEnlace(area);
    setErrorMessage(null);

    try {
      // Helper para convertir estados detallados (B/R/M/NT) a estados simples (Bueno/Malo/NA)
      const mapEstadoDetallado = (estado: string | null | undefined): "Bueno" | "Malo" | "NA" | null => {
        if (estado === null || estado === undefined) return null;
        if (estado === "B") return "Bueno";
        if (estado === "R" || estado === "M") return "Malo";
        if (estado === "NT") return "NA";
        return null;
      };

      // Helper para calcular estado general de elementos
      const calcularEstadoGeneral = (
        elementos: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!elementos) return "NA";
        const estados = Object.values(elementos).map((e) => e.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      // Helper para calcular estado general de criterios de extintor
      const calcularEstadoExtintor = (
        criterios: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!criterios) return "NA";
        const estados = Object.values(criterios).map((c) => c.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      // Filtrar solo equipos del área
      const inspeccionesArea = inspecciones.filter((i) => i.equipo.area === area);
      
      const detalles = inspeccionesArea.map((i) => {
        const isExtintor = i.equipo.categoria === "Extintor";
        const isBotiquin = i.equipo.categoria === "Botiquin";
        const isCamilla = i.equipo.categoria === "Camilla";
        const isKit = i.equipo.categoria === "Kit Derrames";

        let estadoGeneral = i.criteriosComunes.estadoGeneral;
        let senalizacion = i.criteriosComunes.senalizacion;
        let accesibilidad = i.criteriosComunes.accesibilidad;

        if (isExtintor && !estadoGeneral) {
          estadoGeneral = calcularEstadoExtintor(i.criteriosExtintorDetalle);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isBotiquin && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isCamilla && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosCamilla as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isKit && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        }

        return {
          equipoRecordId: i.equipoId,
          codigoEquipo: i.equipo.codigo,
          nombreEquipo: i.equipo.nombre,
          categoria: i.equipo.categoria,
          area: i.equipo.area,
          estadoGeneral,
          senalizacion,
          accesibilidad,
          presionManometro: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.presion?.estado)
            : i.criteriosExtintor.presionManometro,
          manguera: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.boquillaManguera?.estado)
            : i.criteriosExtintor.manguera,
          pinSeguridad: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.pinSeguridad?.estado)
            : i.criteriosExtintor.pinSeguridad,
          soporteBase: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.selloGarantia?.estado)
            : i.criteriosExtintor.soporteBase,
          estructura: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.estructura?.estado)
            : i.criteriosCamilla.estructura,
          correasArnes: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.correasArnes?.estado)
            : i.criteriosCamilla.correasArnes,
          completitudElementos: isBotiquin
            ? calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>)
            : (isKit ? calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>) : null),
          estadoContenedor: isBotiquin || isKit ? "Bueno" : null,
          criteriosExtintorDetalle: isExtintor ? i.criteriosExtintorDetalle : null,
          elementosBotiquin: isBotiquin ? i.elementosBotiquin : null,
          elementosKit: isKit ? i.elementosKit : null,
          verificacionesKit: isKit ? i.verificacionesKit : null,
          elementosCamilla: isCamilla ? i.elementosCamilla : null,
          infoExtintor: isExtintor ? i.infoExtintor : null,
          fechaVencimiento: i.fechaVencimiento || null,
          observaciones: i.observaciones,
        };
      });

      const payload = {
        fechaInspeccion,
        inspector,
        area,
        observacionesGenerales: `Inspección - Área: ${area}`,
        detalles,
        responsable: {
          nombre: firmaArea.nombre,
          cedula: firmaArea.cedula,
          cargo: firmaArea.cargo || "Responsable de Área",
        },
        // Firmas globales obligatorias (ya validadas arriba)
        firmaSST: {
          nombre: firmaSST.nombre,
          cedula: firmaSST.cedula,
          cargo: firmaSST.cargo,
          firma: firmaSST.firma,
        },
        firmaCOPASST: {
          nombre: firmaCOPASST.nombre,
          cedula: firmaCOPASST.cedula,
          cargo: firmaCOPASST.cargo,
          firma: firmaCOPASST.firma,
        },
      };

      const res = await fetch("/api/inspecciones-equipos/generar-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success && json.data?.firmaUrl) {
        // Guardar el enlace (el área NO está guardada aún, solo el enlace)
        setEnlacesFirma((prev) => ({ ...prev, [area]: json.data.firmaUrl }));
        // NO marcar como guardada - se guardará cuando el responsable firme y se confirme
        setPageState("success");
        setTimeout(() => setPageState("idle"), 3000);
      } else {
        throw new Error(json.message || "Error al generar el enlace");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerandoEnlace(null);
    }
  };

  // Copiar enlace al portapapeles
  const copiarEnlace = async (area: string) => {
    const enlace = enlacesFirma[area];
    if (!enlace) return;
    
    try {
      await navigator.clipboard.writeText(enlace);
      setEnlaceCopiado(area);
      setTimeout(() => setEnlaceCopiado(null), 2000);
    } catch {
      setErrorMessage("No se pudo copiar el enlace");
    }
  };

  // Verificar si la firma remota ya se completó
  // silent: si es true, no muestra mensajes de error (para polling automático)
  const verificarFirmaRemota = async (area: string, silent = false) => {
    const enlace = enlacesFirma[area];
    if (!enlace) return false;

    // Extraer el token del enlace
    const url = new URL(enlace);
    const token = url.searchParams.get("t");
    if (!token) return false;

    if (!silent) setVerificandoFirma(area);

    try {
      const res = await fetch(`/api/inspecciones-equipos/token/validar?t=${encodeURIComponent(token)}`);
      const json = await res.json();

      if (json.success && json.data) {
        if (json.data.yaFirmado && json.data.firmaData) {
          // La firma se completó remotamente - obtener la firma real
          setFirmasRemotas((prev) => ({ ...prev, [area]: true }));
          
          // Actualizar firmasAreas con la firma REAL obtenida del servidor
          setFirmasAreas((prev) =>
            prev.map((f) =>
              f.area === area
                ? { ...f, firma: json.data.firmaData.firma }
                : f
            )
          );
          
          if (!silent) {
            setPageState("success");
            setTimeout(() => setPageState("idle"), 2000);
          }
          return true;
        } else {
          if (!silent) {
            setErrorMessage(`La firma del área "${area}" aún está pendiente.`);
          }
        }
      }
    } catch {
      if (!silent) {
        setErrorMessage("Error al verificar el estado de la firma");
      }
    } finally {
      if (!silent) setVerificandoFirma(null);
    }
    return false;
  };

  // Polling automático para verificar firmas remotas pendientes
  useEffect(() => {
    // Solo hacer polling si hay enlaces generados y firmas pendientes
    const enlacesPendientes = Object.entries(enlacesFirma).filter(
      ([area]) => !firmasRemotas[area]
    );

    if (enlacesPendientes.length === 0) return;

    const intervalId = setInterval(() => {
      enlacesPendientes.forEach(([area]) => {
        verificarFirmaRemota(area, true); // Verificar silenciosamente
      });
    }, 5000); // Verificar cada 5 segundos

    return () => clearInterval(intervalId);
  }, [enlacesFirma, firmasRemotas]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════
  // Funciones para gestión de equipos (editar/agregar)
  // ══════════════════════════════════════════════════════════
  
  // Abrir modal para editar equipo existente
  const abrirModalEditarEquipo = (equipo: EquipoItem) => {
    setEquipoEditando(equipo);
    setFormEquipo({
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      categoria: equipo.categoria,
      tipoEspecifico: equipo.tipoEspecifico,
      area: equipo.area,
      ubicacion: equipo.ubicacion,
      capacidad: equipo.capacidad,
      fechaVencimiento: equipo.fechaVencimiento,
      estado: equipo.estado,
      descripcion: equipo.descripcion,
    });
    setAreaParaNuevoEquipo(null);
    setModalEquipoAbierto(true);
  };

  // Abrir modal para agregar nuevo equipo en un área
  const abrirModalNuevoEquipo = (area: string) => {
    setEquipoEditando(null);
    setFormEquipo({
      codigo: "",
      nombre: "",
      categoria: "Extintor",
      tipoEspecifico: "",
      area: area,
      ubicacion: "",
      capacidad: "",
      fechaVencimiento: null,
      estado: "Activo",
      descripcion: "",
    });
    setAreaParaNuevoEquipo(area);
    setModalEquipoAbierto(true);
  };

  // Cerrar modal
  const cerrarModalEquipo = () => {
    setModalEquipoAbierto(false);
    setEquipoEditando(null);
    setAreaParaNuevoEquipo(null);
    setFormEquipo({
      codigo: "",
      nombre: "",
      categoria: "Extintor",
      tipoEspecifico: "",
      area: "",
      ubicacion: "",
      capacidad: "",
      fechaVencimiento: null,
      estado: "Activo",
      descripcion: "",
    });
  };

  // Guardar equipo (crear o actualizar)
  const guardarEquipo = async () => {
    // Validar campos requeridos
    if (!formEquipo.nombre?.trim() || !formEquipo.categoria || !formEquipo.area) {
      setErrorMessage("Nombre, categoría y área son requeridos");
      return;
    }

    setGuardandoEquipo(true);
    setErrorMessage(null);

    try {
      const url = "/api/equipos-emergencia";
      const method = equipoEditando ? "PUT" : "POST";
      const body = equipoEditando 
        ? { id: equipoEditando.id, ...formEquipo }
        : formEquipo;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!json.success) {
        setErrorMessage(json.message || "Error al guardar el equipo");
        return;
      }

      // Recargar la lista de equipos para reflejar los cambios
      await fetchEquipos();
      cerrarModalEquipo();
    } catch {
      setErrorMessage("Error de conexión al guardar el equipo");
    } finally {
      setGuardandoEquipo(false);
    }
  };

  // Guardar inspección
  const guardarInspeccion = async () => {
    if (!todosInspeccionados) {
      setErrorMessage(`Debe inspeccionar todos los equipos. Faltan ${totalEquipos - equiposInspeccionados} equipos.`);
      return;
    }

    if (!todasLasFirmas) {
      const faltantes: string[] = [];
      if (firmasAreasCompletas < firmasAreas.length) faltantes.push("Responsables de Área");
      if (firmaSST.firma === null) faltantes.push("Responsable SST");
      if (firmaCOPASST.firma === null) faltantes.push("Responsable COPASST");
      setErrorMessage(`Faltan firmas: ${faltantes.join(", ")}`);
      return;
    }

    setPageState("saving");
    setErrorMessage(null);

    try {
      // Helper para convertir estados detallados (B/R/M/NT) a estados simples (Bueno/Malo/NA)
      const mapEstadoDetallado = (estado: string | null | undefined): "Bueno" | "Malo" | "NA" | null => {
        if (estado === null || estado === undefined) return null;
        if (estado === "B") return "Bueno";
        if (estado === "R" || estado === "M") return "Malo";
        if (estado === "NT") return "NA";
        return null;
      };

      // Helper para calcular estado general de elementos
      const calcularEstadoGeneral = (
        elementos: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!elementos) return "NA";
        const estados = Object.values(elementos).map((e) => e.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      // Helper para calcular estado general de criterios de extintor
      const calcularEstadoExtintor = (
        criterios: Record<string, { estado: string | null }> | null | undefined
      ): "Bueno" | "Malo" | "NA" => {
        if (!criterios) return "NA";
        const estados = Object.values(criterios).map((c) => c.estado).filter(Boolean);
        if (estados.length === 0) return "NA";
        const malos = estados.filter((e) => e === "M" || e === "R").length;
        if (malos > 0) return "Malo";
        return "Bueno";
      };

      const detalles = inspecciones.map((i) => {
        // Determinar tipo de equipo
        const isExtintor = i.equipo.categoria === "Extintor";
        const isBotiquin = i.equipo.categoria === "Botiquin";
        const isCamilla = i.equipo.categoria === "Camilla";
        const isKit = i.equipo.categoria === "Kit Derrames";

        // Auto-calcular criterios comunes si no están llenos (para equipos con formularios específicos)
        let estadoGeneral = i.criteriosComunes.estadoGeneral;
        let senalizacion = i.criteriosComunes.senalizacion;
        let accesibilidad = i.criteriosComunes.accesibilidad;

        // Si el equipo tiene formulario específico y criterios comunes en null, calcular
        if (isExtintor && !estadoGeneral) {
          estadoGeneral = calcularEstadoExtintor(i.criteriosExtintorDetalle);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isBotiquin && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isCamilla && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosCamilla as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        } else if (isKit && !estadoGeneral) {
          estadoGeneral = calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>);
          senalizacion = senalizacion || "Bueno";
          accesibilidad = accesibilidad || "Bueno";
        }

        return {
          equipoRecordId: i.equipoId,
          codigoEquipo: i.equipo.codigo,
          nombreEquipo: i.equipo.nombre,
          categoria: i.equipo.categoria,
          area: i.equipo.area,
          // Criterios comunes (calculados si no están llenos)
          estadoGeneral,
          senalizacion,
          accesibilidad,
          // Criterios extintor: mapear desde datos detallados si es extintor
          presionManometro: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.presion?.estado)
            : i.criteriosExtintor.presionManometro,
          manguera: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.boquillaManguera?.estado)
            : i.criteriosExtintor.manguera,
          pinSeguridad: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.pinSeguridad?.estado)
            : i.criteriosExtintor.pinSeguridad,
          soporteBase: isExtintor
            ? mapEstadoDetallado(i.criteriosExtintorDetalle?.selloGarantia?.estado)
            : i.criteriosExtintor.soporteBase,
          // Criterios camilla
          estructura: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.estructura?.estado)
            : i.criteriosCamilla.estructura,
          correasArnes: isCamilla
            ? mapEstadoDetallado(i.elementosCamilla?.correasArnes?.estado)
            : i.criteriosCamilla.correasArnes,
          // Criterios botiquín/kit: calcular completitud basada en elementos
          completitudElementos: isBotiquin
            ? calcularEstadoGeneral(i.elementosBotiquin as Record<string, { estado: string | null }>)
            : (isKit ? calcularEstadoGeneral(i.elementosKit as Record<string, { estado: string | null }>) : null),
          estadoContenedor: isBotiquin || isKit ? "Bueno" : null,
          // Datos detallados serializados para guardado completo
          criteriosExtintorDetalle: isExtintor ? i.criteriosExtintorDetalle : null,
          elementosBotiquin: isBotiquin ? i.elementosBotiquin : null,
          elementosKit: isKit ? i.elementosKit : null,
          verificacionesKit: isKit ? i.verificacionesKit : null,
          elementosCamilla: isCamilla ? i.elementosCamilla : null,
          infoExtintor: isExtintor ? i.infoExtintor : null,
          fechaVencimiento: i.fechaVencimiento || null,
          observaciones: i.observaciones,
        };
      });

      const responsables = firmasAreas
        .filter((f) => f.firma !== null && f.nombre.trim() !== "")
        .map((f) => ({
          tipo: "Responsable Área",
          area: f.area,
          nombre: f.nombre,
          cedula: f.cedula,
          cargo: f.cargo,
          firma: f.firma!,
        }));

      // Agregar firma SST
      if (firmaSST.firma && firmaSST.nombre.trim()) {
        responsables.push({
          tipo: "Responsable SST",
          area: null as unknown as string,
          nombre: firmaSST.nombre,
          cedula: firmaSST.cedula,
          cargo: firmaSST.cargo,
          firma: firmaSST.firma,
        });
      }

      // Agregar firma COPASST
      if (firmaCOPASST.firma && firmaCOPASST.nombre.trim()) {
        responsables.push({
          tipo: "Responsable COPASST",
          area: null as unknown as string,
          nombre: firmaCOPASST.nombre,
          cedula: firmaCOPASST.cedula,
          cargo: firmaCOPASST.cargo,
          firma: firmaCOPASST.firma,
        });
      }

      const payload = {
        fechaInspeccion,
        inspector,
        observacionesGenerales: "",
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
        // Subir fotos de equipos en segundo plano (no bloquea el éxito)
        const detalleMap: { equipoRecordId: string; detalleRecordId: string | null }[] = json.data?.detalleMap ?? [];
        if (detalleMap.length > 0 && Object.keys(fotosEquipo).length > 0) {
          (async () => {
            for (const entry of detalleMap) {
              if (!entry.detalleRecordId) continue;
              const foto = fotosEquipo[entry.equipoRecordId];
              if (!foto) continue;
              try {
                const presignRes = await fetch("/api/inspecciones-equipos/foto-equipo/presign", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    detalleRecordId: entry.detalleRecordId,
                    foto: { name: foto.name, type: foto.type, size: foto.size },
                  }),
                });
                const pd = await presignRes.json();
                if (!pd.success) continue;
                const { key, uploadUrl } = pd.upload;
                const putRes = await fetch(uploadUrl, { method: "PUT", body: foto, headers: { "Content-Type": foto.type } });
                if (!putRes.ok) continue;
                await fetch("/api/inspecciones-equipos/foto-equipo", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ detalleRecordId: entry.detalleRecordId, s3Key: key }),
                });
              } catch (photoErr) {
                console.error("Error subiendo foto de equipo:", photoErr);
              }
            }
          })();
        }
        // Inspección completa guardada → eliminar borrador
        eliminarBorrador();
        setBorradorGuardadoEn(null);
        setFotosBase64({});
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
                onClick={() => router.push("/dashboard/inspecciones-equipos/equipos")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <Package size={18} />
                <span className="hidden sm:inline">Equipos</span>
              </button>
              <button
                onClick={() => router.push("/dashboard/inspecciones-equipos/historial")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <History size={18} />
                <span className="hidden sm:inline">Historial</span>
              </button>
              
              {/* Indicador de borrador guardado */}
              {borradorGuardadoEn && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
                    <Clock size={12} className="text-amber-400" />
                    <span className="text-[11px] text-amber-300 font-medium">
                      Borrador guardado {borradorGuardadoEn.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <button
                    onClick={limpiarBorrador}
                    title="Descartar borrador y reiniciar formulario"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-300 border border-white/15 hover:border-red-500/30 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Indicador de áreas guardadas */}
              {areasGuardadas.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-xs text-green-300">
                    {areasGuardadas.size}/{areas.length} áreas
                  </span>
                </div>
              )}
              
              <button
                onClick={guardarInspeccion}
                disabled={pageState === "saving" || !todosInspeccionados || !todasLasFirmas}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={
                  areasGuardadas.size === areas.length && areas.length > 0
                    ? "Todas las áreas ya fueron guardadas"
                    : !todosInspeccionados 
                      ? `Faltan ${totalEquipos - equiposInspeccionados} equipos por inspeccionar` 
                      : !todasLasFirmas 
                        ? "Faltan firmas de responsables" 
                        : "Guardar todas las áreas restantes"
                }
              >
                {pageState === "saving" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span className="hidden sm:inline">Guardar Todo</span>
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
              <div className="relative">
                <select
                  value={inspector}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setInspector(selectedName);
                    // Pre-cargar automáticamente en Responsable SST
                    const responsable = responsablesSST.find(r => r.nombre === selectedName);
                    if (responsable) {
                      setFirmaSST({
                        tipo: "SST",
                        nombre: responsable.nombre,
                        cedula: responsable.cedula || "",
                        cargo: responsable.cargo || "",
                        firma: null
                      });
                    } else {
                      setFirmaSST({ tipo: "SST", nombre: "", cedula: "", cargo: "", firma: null });
                    }
                  }}
                  disabled={cargandoResponsablesSST}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="" className="bg-slate-800">
                    {cargandoResponsablesSST ? "Cargando..." : "Seleccionar inspector..."}
                  </option>
                  {responsablesSST.map((r) => (
                    <option key={r.id} value={r.nombre} className="bg-slate-800">
                      {r.nombre}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
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
                <p className="text-xs text-white/60">Firmas por área</p>
                <p className="text-xl font-bold text-green-400">{firmasAreas.filter(f => f.firma).length} / {firmasAreas.length}</p>
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
            .map(([area, equiposArea]) => {
              const firmaArea = firmasAreas.find((f) => f.area === area);
              const equiposAreaInspeccionados = equiposArea.filter(equipoInspeccionado).length;
              
              return (
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
                          {equiposAreaInspeccionados}/{equiposArea.length} equipos inspeccionados
                          {" · "}
                          {[...new Set(equiposArea.map((e) => e.equipo.categoria))].join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {firmaArea?.firma ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          Firmado
                        </span>
                      ) : (
                        <span className="text-xs text-white/40">Sin firma</span>
                      )}
                      {expandedAreas[area] ? (
                        <ChevronUp className="w-5 h-5 text-white/50" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/50" />
                      )}
                    </div>
                  </button>

                  {/* Equipos del Área */}
                  {expandedAreas[area] && (
                    <div className="border-t border-white/10">
                      {equiposArea.map((insp, idx) => {
                        const catConfig = CATEGORIA_CONFIG[insp.equipo.categoria] || CATEGORIA_CONFIG.Extintor;
                        const isBotiquin = insp.equipo.categoria === "Botiquin";
                        const isExtintor = insp.equipo.categoria === "Extintor";
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
                                    {equipoInspeccionado(insp) && (
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                    )}
                                    {/* Botón editar equipo */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        abrirModalEditarEquipo(insp.equipo);
                                      }}
                                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                                      title="Editar características del equipo"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
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

                            {/* Contenido según categoría */}
                            {isBotiquin ? (
                              // ═══ INSPECCIÓN DE BOTIQUÍN ═══
                              <div>
                                <button
                                  onClick={() => toggleBotiquin(insp.equipoId)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-green-400" />
                                    <span className="text-sm font-medium text-green-300">
                                      Inspección de Elementos del Botiquín
                                    </span>
                                    <span className="text-xs text-white/50">
                                      ({ELEMENTOS_BOTIQUIN.filter((el) => insp.elementosBotiquin[el.id]?.estado !== null).length}/{ELEMENTOS_BOTIQUIN.length} elementos)
                                    </span>
                                  </div>
                                  {expandedBotiquines[insp.equipoId] ? (
                                    <ChevronUp className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-green-400" />
                                  )}
                                </button>

                                {expandedBotiquines[insp.equipoId] && (
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-white/10">
                                          <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">UND</th>
                                          <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">ELEMENTO</th>
                                          <th className="text-center py-2 px-2 text-white/60 font-medium text-xs" colSpan={4}>ESTADO</th>
                                          <th className="text-center py-2 px-2 text-white/60 font-medium text-xs">CANT.</th>
                                          <th className="text-center py-2 px-2 text-white/60 font-medium text-xs">F. VENC.</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ELEMENTOS_BOTIQUIN.map((elem) => (
                                          <tr key={elem.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-2 px-2 text-white/50 text-xs">{elem.unidadRequerida}</td>
                                            <td className="py-2 px-2 text-white text-xs">{elem.nombre}</td>
                                            <td className="py-2 px-2" colSpan={4}>
                                              <EstadoElementoSelector
                                                value={insp.elementosBotiquin[elem.id]?.estado || null}
                                                onChange={(val) => actualizarElementoBotiquin(insp.equipoId, elem.id, "estado", val as EstadoElemento)}
                                              />
                                            </td>
                                            <td className="py-2 px-2">
                                              <input
                                                type="text"
                                                value={insp.elementosBotiquin[elem.id]?.cantidad || ""}
                                                onChange={(e) => actualizarElementoBotiquin(insp.equipoId, elem.id, "cantidad", e.target.value)}
                                                placeholder={String(elem.unidadRequerida)}
                                                className="w-12 px-1 py-0.5 text-xs text-center rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none"
                                              />
                                            </td>
                                            <td className="py-2 px-2">
                                              <input
                                                type="date"
                                                value={insp.elementosBotiquin[elem.id]?.fechaVencimiento || ""}
                                                onChange={(e) => actualizarElementoBotiquin(insp.equipoId, elem.id, "fechaVencimiento", e.target.value)}
                                                className="w-28 px-1 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white focus:outline-none"
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {/* Leyenda estados */}
                                    <div className="mt-2 flex gap-3 text-[10px] text-white/50">
                                      <span><span className="font-bold text-green-400">B</span> = Bueno</span>
                                      <span><span className="font-bold text-yellow-400">R</span> = Regular</span>
                                      <span><span className="font-bold text-red-400">M</span> = Malo</span>
                                      <span><span className="font-bold text-gray-400">NT</span> = No Tiene</span>
                                    </div>
                                  </div>
                                )}

                                {/* Observaciones */}
                                <div className="mt-3">
                                  <input
                                    type="text"
                                    value={insp.observaciones}
                                    onChange={(e) => actualizarObservaciones(insp.equipoId, e.target.value)}
                                    placeholder="Observaciones del botiquín..."
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-green-400/50"
                                  />
                                </div>
                              </div>
                            ) : isExtintor ? (
                              // ═══ INSPECCIÓN DE EXTINTOR ═══
                              <div>
                                <button
                                  onClick={() => toggleExtintor(insp.equipoId)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-red-400" />
                                    <span className="text-sm font-medium text-red-300">
                                      Inspección Detallada del Extintor
                                    </span>
                                    <span className="text-xs text-white/50">
                                      ({CRITERIOS_EXTINTOR_DETALLE.filter((c) => insp.criteriosExtintorDetalle[c.id]?.estado !== null).length}/{CRITERIOS_EXTINTOR_DETALLE.length} criterios)
                                    </span>
                                  </div>
                                  {expandedExtintores[insp.equipoId] ? (
                                    <ChevronUp className="w-4 h-4 text-red-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-red-400" />
                                  )}
                                </button>

                                {expandedExtintores[insp.equipoId] && (
                                  <div className="mt-3">
                                    {/* Info del Extintor */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                                      <div>
                                        <label className="block text-[10px] text-red-300/70 mb-1">Clase Agente</label>
                                        <input
                                          type="text"
                                          value={insp.infoExtintor.claseAgente}
                                          onChange={(e) => actualizarInfoExtintor(insp.equipoId, "claseAgente", e.target.value)}
                                          placeholder="ABC, CO2..."
                                          className="w-full px-2 py-1.5 text-xs rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-red-300/70 mb-1">Tipo Extintor</label>
                                        <input
                                          type="text"
                                          value={insp.infoExtintor.tipoExtintor}
                                          onChange={(e) => actualizarInfoExtintor(insp.equipoId, "tipoExtintor", e.target.value)}
                                          placeholder="PQS, CO2, Agua..."
                                          className="w-full px-2 py-1.5 text-xs rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-red-300/70 mb-1">Capacidad</label>
                                        <input
                                          type="text"
                                          value={insp.infoExtintor.capacidad}
                                          onChange={(e) => actualizarInfoExtintor(insp.equipoId, "capacidad", e.target.value)}
                                          placeholder="10 Lb, 20 Lb..."
                                          className="w-full px-2 py-1.5 text-xs rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-red-300/70 mb-1">F. Próxima Recarga</label>
                                        <input
                                          type="date"
                                          value={insp.infoExtintor.fechaProximaRecarga}
                                          onChange={(e) => actualizarInfoExtintor(insp.equipoId, "fechaProximaRecarga", e.target.value)}
                                          className="w-full px-2 py-1.5 text-xs rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                        />
                                      </div>
                                    </div>

                                    {/* Tabla de criterios */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-white/10">
                                            <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">ASPECTO</th>
                                            <th className="text-center py-2 px-2 text-white/60 font-medium text-xs" colSpan={3}>ESTADO</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {CRITERIOS_EXTINTOR_DETALLE.map((criterio) => (
                                            <tr key={criterio.id} className="border-b border-white/5 hover:bg-white/5">
                                              <td className="py-2 px-2 text-white text-xs">{criterio.nombre}</td>
                                              <td className="py-2 px-2" colSpan={3}>
                                                <div className="flex items-center justify-center gap-1">
                                                  {(["B", "R", "M"] as EstadoExtintor[]).map((estado) => (
                                                    <button
                                                      key={estado}
                                                      onClick={() => actualizarCriterioExtintor(insp.equipoId, criterio.id, estado)}
                                                      className={`w-8 h-6 rounded text-xs font-bold transition-all ${
                                                        insp.criteriosExtintorDetalle[criterio.id]?.estado === estado
                                                          ? estado === "B"
                                                            ? "bg-green-500 text-white"
                                                            : estado === "R"
                                                              ? "bg-yellow-500 text-black"
                                                              : "bg-red-500 text-white"
                                                          : "bg-white/10 text-white/40 hover:bg-white/20"
                                                      }`}
                                                    >
                                                      {estado}
                                                    </button>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {/* Leyenda estados */}
                                      <div className="mt-2 flex gap-3 text-[10px] text-white/50">
                                        <span><span className="font-bold text-green-400">B</span> = Bueno</span>
                                        <span><span className="font-bold text-yellow-400">R</span> = Regular</span>
                                        <span><span className="font-bold text-red-400">M</span> = Malo</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Observaciones */}
                                <div className="mt-3">
                                  <input
                                    type="text"
                                    value={insp.observaciones}
                                    onChange={(e) => actualizarObservaciones(insp.equipoId, e.target.value)}
                                    placeholder="Observaciones del extintor..."
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                  />
                                </div>
                              </div>
                            ) : insp.equipo.categoria === "Kit Derrames" ? (
                              // ═══ INSPECCIÓN DE KIT DE DERRAMES ═══
                              <div>
                                <button
                                  onClick={() => toggleKit(insp.equipoId)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm font-medium text-yellow-300">
                                      Inspección de Elementos del Kit de Derrames
                                    </span>
                                    <span className="text-xs text-white/50">
                                      ({ELEMENTOS_KIT_DERRAMES.filter((el) => insp.elementosKit[el.id]?.estado !== null).length}/{ELEMENTOS_KIT_DERRAMES.length} elementos)
                                    </span>
                                  </div>
                                  {expandedKits[insp.equipoId] ? (
                                    <ChevronUp className="w-4 h-4 text-yellow-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-yellow-400" />
                                  )}
                                </button>

                                {expandedKits[insp.equipoId] && (
                                  <div className="mt-3">
                                    {/* Tabla de elementos */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-white/10">
                                            <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">UND</th>
                                            <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">ELEMENTO</th>
                                            <th className="text-center py-2 px-2 text-white/60 font-medium text-xs" colSpan={4}>ESTADO</th>
                                            <th className="text-center py-2 px-2 text-white/60 font-medium text-xs">CANT.</th>
                                            <th className="text-center py-2 px-2 text-white/60 font-medium text-xs">F. VENC.</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {ELEMENTOS_KIT_DERRAMES.map((elem) => (
                                            <tr key={elem.id} className="border-b border-white/5 hover:bg-white/5">
                                              <td className="py-2 px-2 text-white/50 text-xs">{elem.unidadRequerida}</td>
                                              <td className="py-2 px-2 text-white text-xs">{elem.nombre}</td>
                                              <td className="py-2 px-2" colSpan={4}>
                                                <div className="flex items-center justify-center gap-1">
                                                  {(["B", "R", "M", "NT"] as EstadoKit[]).map((estado) => (
                                                    <button
                                                      key={estado}
                                                      onClick={() => actualizarElementoKit(insp.equipoId, elem.id, "estado", estado)}
                                                      className={`w-7 h-6 rounded text-[10px] font-bold transition-all ${
                                                        insp.elementosKit[elem.id]?.estado === estado
                                                          ? estado === "B"
                                                            ? "bg-green-500 text-white"
                                                            : estado === "R"
                                                              ? "bg-yellow-500 text-black"
                                                              : estado === "M"
                                                                ? "bg-red-500 text-white"
                                                                : "bg-gray-500 text-white"
                                                          : "bg-white/10 text-white/40 hover:bg-white/20"
                                                      }`}
                                                    >
                                                      {estado}
                                                    </button>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="py-2 px-2">
                                                <input
                                                  type="text"
                                                  value={insp.elementosKit[elem.id]?.cantidad || ""}
                                                  onChange={(e) => actualizarElementoKit(insp.equipoId, elem.id, "cantidad", e.target.value)}
                                                  placeholder={String(elem.unidadRequerida)}
                                                  className="w-12 px-1 py-0.5 text-xs text-center rounded bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none"
                                                />
                                              </td>
                                              <td className="py-2 px-2">
                                                <input
                                                  type="date"
                                                  value={insp.elementosKit[elem.id]?.fechaVencimiento || ""}
                                                  onChange={(e) => actualizarElementoKit(insp.equipoId, elem.id, "fechaVencimiento", e.target.value)}
                                                  className="w-28 px-1 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white focus:outline-none"
                                                />
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {/* Leyenda estados */}
                                      <div className="mt-2 flex gap-3 text-[10px] text-white/50">
                                        <span><span className="font-bold text-green-400">B</span> = Bueno</span>
                                        <span><span className="font-bold text-yellow-400">R</span> = Regular</span>
                                        <span><span className="font-bold text-red-400">M</span> = Malo</span>
                                        <span><span className="font-bold text-gray-400">NT</span> = No Tiene</span>
                                      </div>
                                    </div>

                                    {/* Verificaciones del kit */}
                                    <div className="mt-4 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
                                      <h5 className="text-xs font-semibold text-yellow-300 mb-3">Verificaciones del Kit</h5>
                                      <div className="space-y-3">
                                        {VERIFICACIONES_KIT.map((ver) => (
                                          <div key={ver.id} className="flex items-start gap-3">
                                            <div className="flex items-center gap-2 min-w-[80px]">
                                              <button
                                                onClick={() => actualizarVerificacionKit(insp.equipoId, ver.id, true)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                                  insp.verificacionesKit[ver.id]?.respuesta === true
                                                    ? "bg-green-500 text-white"
                                                    : "bg-white/10 text-white/40 hover:bg-white/20"
                                                }`}
                                              >
                                                SÍ
                                              </button>
                                              <button
                                                onClick={() => actualizarVerificacionKit(insp.equipoId, ver.id, false)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                                  insp.verificacionesKit[ver.id]?.respuesta === false
                                                    ? "bg-red-500 text-white"
                                                    : "bg-white/10 text-white/40 hover:bg-white/20"
                                                }`}
                                              >
                                                NO
                                              </button>
                                            </div>
                                            <span className="text-xs text-white/80 flex-1">{ver.pregunta}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Observaciones */}
                                <div className="mt-3">
                                  <input
                                    type="text"
                                    value={insp.observaciones}
                                    onChange={(e) => actualizarObservaciones(insp.equipoId, e.target.value)}
                                    placeholder="Observaciones del kit de derrames..."
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                                  />
                                </div>
                              </div>
                            ) : insp.equipo.categoria === "Camilla" ? (
                              // ═══ INSPECCIÓN DE CAMILLA ═══
                              <div>
                                <button
                                  onClick={() => toggleCamilla(insp.equipoId)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-blue-400" />
                                    <span className="text-sm font-medium text-blue-300">
                                      Inspección de Elementos de la Camilla
                                    </span>
                                    <span className="text-xs text-white/50">
                                      ({ELEMENTOS_CAMILLA.filter((el) => insp.elementosCamilla[el.id]?.estado !== null).length}/{ELEMENTOS_CAMILLA.length} elementos)
                                    </span>
                                  </div>
                                  {expandedCamillas[insp.equipoId] ? (
                                    <ChevronUp className="w-4 h-4 text-blue-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-blue-400" />
                                  )}
                                </button>

                                {expandedCamillas[insp.equipoId] && (
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-white/10">
                                          <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">UND</th>
                                          <th className="text-left py-2 px-2 text-white/60 font-medium text-xs">ELEMENTO INSPECCIONADO</th>
                                          <th className="text-center py-2 px-2 text-white/60 font-medium text-xs" colSpan={4}>ESTADO</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ELEMENTOS_CAMILLA.map((elem) => (
                                          <tr key={elem.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-2 px-2 text-white/50 text-xs">{elem.unidadRequerida}</td>
                                            <td className="py-2 px-2 text-white text-xs">{elem.nombre}</td>
                                            <td className="py-2 px-2" colSpan={4}>
                                              <div className="flex items-center justify-center gap-1">
                                                {(["B", "R", "M", "NT"] as EstadoCamilla[]).map((estado) => (
                                                  <button
                                                    key={estado}
                                                    onClick={() => actualizarElementoCamilla(insp.equipoId, elem.id, estado)}
                                                    className={`w-7 h-6 rounded text-[10px] font-bold transition-all ${
                                                      insp.elementosCamilla[elem.id]?.estado === estado
                                                        ? estado === "B"
                                                          ? "bg-green-500 text-white"
                                                          : estado === "R"
                                                            ? "bg-yellow-500 text-black"
                                                            : estado === "M"
                                                              ? "bg-red-500 text-white"
                                                              : "bg-gray-500 text-white"
                                                        : "bg-white/10 text-white/40 hover:bg-white/20"
                                                    }`}
                                                  >
                                                    {estado}
                                                  </button>
                                                ))}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {/* Leyenda estados */}
                                    <div className="mt-2 flex gap-3 text-[10px] text-white/50">
                                      <span><span className="font-bold text-green-400">B</span> = Bueno</span>
                                      <span><span className="font-bold text-yellow-400">R</span> = Regular</span>
                                      <span><span className="font-bold text-red-400">M</span> = Malo</span>
                                      <span><span className="font-bold text-gray-400">NT</span> = No Tiene</span>
                                    </div>
                                  </div>
                                )}

                                {/* Observaciones */}
                                <div className="mt-3">
                                  <input
                                    type="text"
                                    value={insp.observaciones}
                                    onChange={(e) => actualizarObservaciones(insp.equipoId, e.target.value)}
                                    placeholder="Observaciones de la camilla..."
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                                  />
                                </div>
                              </div>
                            ) : (
                              // ═══ INSPECCIÓN OTROS EQUIPOS ═══
                              <>
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
                              </>
                            )}
                            {/* Foto de evidencia del equipo */}
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <div className="flex items-center gap-3">
                                {fotosPreviewEquipo[insp.equipoId] ? (
                                  <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/20 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={fotosPreviewEquipo[insp.equipoId]} alt="Evidencia" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Solo revocar si es un object URL (no base64)
                                        if (fotosPreviewEquipo[insp.equipoId]?.startsWith('blob:')) {
                                          URL.revokeObjectURL(fotosPreviewEquipo[insp.equipoId]);
                                        }
                                        setFotosEquipo((prev) => { const n = { ...prev }; delete n[insp.equipoId]; return n; });
                                        setFotosPreviewEquipo((prev) => { const n = { ...prev }; delete n[insp.equipoId]; return n; });
                                        setFotosBase64((prev) => { const n = { ...prev }; delete n[insp.equipoId]; return n; });
                                      }}
                                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-4 h-4 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/50 text-xs cursor-pointer hover:bg-white/10 hover:text-white/70 transition-colors">
                                    <Camera className="w-3.5 h-3.5" />
                                    Foto
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="sr-only"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          guardarEnGaleria(file);
                                          setFotosEquipo((prev) => ({ ...prev, [insp.equipoId]: file }));
                                          setFotosPreviewEquipo((prev) => ({ ...prev, [insp.equipoId]: URL.createObjectURL(file) }));
                                          // Leer como base64 para guardar en borrador
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const dataUrl = ev.target?.result as string;
                                            if (dataUrl) {
                                              setFotosBase64((prev) => ({ ...prev, [insp.equipoId]: { dataUrl, name: file.name, type: file.type } }));
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                )}
                                <span className="text-[10px] text-white/30">Evidencia fotográfica opcional</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Botón para agregar nuevo equipo en esta área */}
                      <div className="p-4 border-t border-white/10">
                        <button
                          onClick={() => abrirModalNuevoEquipo(area)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed border-white/20 text-white/60 text-sm font-medium hover:border-red-400/50 hover:text-red-300 hover:bg-red-500/5 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Agregar Equipo en {area}
                        </button>
                      </div>

                      {/* Firma del Responsable de Área */}
                      {firmaArea && (
                        <div className="p-4 border-t border-white/10 bg-white/5">
                          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-red-400" />
                            Firma Responsable de Área - {area}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            {/* Dropdown de empleados */}
                            <div className="relative">
                              <select
                                value={firmaArea.nombre}
                                onChange={(e) => {
                                  const empleado = todosLosEmpleados.find(
                                    (emp) => emp.nombreCompleto === e.target.value
                                  );
                                  setFirmasAreas((prev) =>
                                    prev.map((f) =>
                                      f.area === area
                                        ? {
                                            ...f,
                                            nombre: e.target.value,
                                            cedula: empleado?.numeroDocumento || "",
                                            cargo: empleado?.cargo || "",
                                          }
                                        : f
                                    )
                                  );
                                }}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-red-400/50 appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-slate-800">
                                  {cargandoEmpleados ? "Cargando..." : "Seleccionar empleado"}
                                </option>
                                {todosLosEmpleados.map((emp) => (
                                  <option key={emp.id} value={emp.nombreCompleto} className="bg-slate-800">
                                    {emp.nombreCompleto}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                            </div>
                            <input
                              type="text"
                              value={firmaArea.cedula}
                              readOnly
                              placeholder="Cédula"
                              className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                            />
                            <input
                              type="text"
                              value={firmaArea.cargo}
                              readOnly
                              placeholder="Cargo"
                              className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                            />
                            {firmaArea.firma ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-sm text-green-400">Firmado</span>
                                <button
                                  onClick={() => setFirmasAreas((prev) => prev.map((f) => f.area === area ? { ...f, firma: null } : f))}
                                  className="ml-auto p-1.5 rounded hover:bg-white/10 text-white/40"
                                >
                                  <Eraser className="w-4 h-4" />
                                </button>
                              </div>
                            ) : enlacesFirma[area] ? (
                              // Ya se generó el enlace, mostrar opciones
                              <div className="flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-blue-400">Enlace generado</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setFirmandoArea(area)}
                                  disabled={!firmaArea.nombre.trim()}
                                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Firmar directamente en esta pantalla"
                                >
                                  <PenTool className="w-3.5 h-3.5" />
                                  Firmar
                                </button>
                                <span className="text-white/30 text-xs">o</span>
                                <button
                                  onClick={() => generarEnlaceFirma(area)}
                                  disabled={!firmaArea.nombre.trim() || !firmaArea.cedula.trim() || generandoEnlace === area || !getEstadisticasArea(area).todosInspeccionados}
                                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Generar enlace para que el responsable firme remotamente"
                                >
                                  {generandoEnlace === area ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Link2 className="w-3.5 h-3.5" />
                                  )}
                                  Enviar Enlace
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Enlace de firma generado */}
                          {enlacesFirma[area] && (
                            <div className={`mt-3 p-3 rounded-lg border ${
                              firmasRemotas[area] 
                                ? "bg-green-500/10 border-green-500/20" 
                                : "bg-blue-500/10 border-blue-500/20"
                            }`}>
                              {firmasRemotas[area] ? (
                                // Firma remota completada
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                  <div>
                                    <p className="text-sm font-medium text-green-400">Firma completada</p>
                                    <p className="text-xs text-green-400/70">
                                      {firmaArea.nombre} firmó remotamente
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                // Enlace pendiente de firma
                                <>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-blue-300 font-medium flex items-center gap-1.5">
                                      <Link2 className="w-3.5 h-3.5" />
                                      Enlace de firma para {firmaArea.nombre}
                                    </span>
                                    <span className="text-[10px] text-blue-400/60">Válido por 72 horas</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={enlacesFirma[area]}
                                      readOnly
                                      className="flex-1 px-2 py-1.5 text-xs rounded bg-white/5 border border-white/10 text-white/70 truncate"
                                    />
                                    <button
                                      onClick={() => copiarEnlace(area)}
                                      className={`p-2 rounded-lg transition-all ${
                                        enlaceCopiado === area
                                          ? "bg-green-500/20 text-green-400"
                                          : "bg-white/10 hover:bg-white/20 text-white/70"
                                      }`}
                                      title={enlaceCopiado === area ? "¡Copiado!" : "Copiar enlace"}
                                    >
                                      {enlaceCopiado === area ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                    <a
                                      href={enlacesFirma[area]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-all"
                                      title="Abrir enlace en nueva pestaña"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <button
                                      onClick={() => verificarFirmaRemota(area)}
                                      disabled={verificandoFirma === area}
                                      className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-all disabled:opacity-50"
                                      title="Verificar si ya firmó"
                                    >
                                      {verificandoFirma === area ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-white/40 mt-2">
                                    Comparte este enlace. Presiona <RefreshCw className="w-3 h-3 inline" /> para verificar si ya firmó.
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Botón Guardar Área */}
                          {(() => {
                            const statsArea = getEstadisticasArea(area);
                            const tieneEnlace = !!enlacesFirma[area];
                            const firmaRemotaCompletada = !!firmasRemotas[area];
                            
                            // Si ya está guardada en BD
                            if (statsArea.yaGuardada) {
                              return (
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="text-xs text-green-400">
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle className="w-4 h-4" />
                                      Área guardada exitosamente
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Si se generó enlace y la firma remota YA se completó
                            // Mostrar botón para guardar definitivamente
                            if (tieneEnlace && firmaRemotaCompletada) {
                              return (
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="text-xs text-green-400">
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle className="w-4 h-4" />
                                      Firma remota recibida
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => guardarInspeccionPorArea(area)}
                                    disabled={guardandoArea === area}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-green-500 hover:bg-green-600 text-white"
                                  >
                                    {guardandoArea === area ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Guardando...
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-4 h-4" />
                                        Confirmar y Guardar
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            }
                            
                            // Si se generó enlace pero aún no se ha firmado remotamente
                            if (tieneEnlace) {
                              return (
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="text-xs text-yellow-400">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-4 h-4" />
                                      Esperando firma remota del responsable...
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Estado normal - no hay enlace generado
                            return (
                              <div className="mt-4 flex items-center justify-between">
                                <div className="text-xs text-white/50">
                                  <span>
                                    {statsArea.inspeccionados}/{statsArea.total} equipos inspeccionados
                                    {!statsArea.firmaCompleta && " · Falta firma"}
                                  </span>
                                </div>
                                <button
                                  onClick={() => guardarInspeccionPorArea(area)}
                                  disabled={!statsArea.puedeGuardar || guardandoArea === area}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    statsArea.puedeGuardar
                                      ? "bg-red-500 hover:bg-red-600 text-white"
                                      : "bg-white/10 border border-white/20 text-white/50 cursor-not-allowed"
                                  }`}
                                  title={
                                    statsArea.yaGuardada
                                      ? "Área ya guardada"
                                      : !statsArea.todosInspeccionados
                                        ? `Faltan ${statsArea.total - statsArea.inspeccionados} equipos por inspeccionar`
                                        : !statsArea.firmaCompleta
                                          ? "Falta la firma del responsable de área"
                                          : `Guardar inspección del área ${area}`
                                  }
                                >
                                  {guardandoArea === area ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : statsArea.yaGuardada ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                  {statsArea.yaGuardada ? "Guardado" : "Guardar Área"}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        )}

        {/* Firmas Globales (Responsable SST y COPASST) */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Firmas de Responsables SST y COPASST
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Firma Responsable SST */}
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="text-sm font-semibold text-purple-300 mb-3">Responsable SST</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {/* Dropdown de responsables SST */}
                <div className="relative">
                  <select
                    value={firmaSST.nombre}
                    onChange={(e) => {
                      const resp = responsablesSST.find(
                        (r) => r.nombre === e.target.value
                      );
                      setFirmaSST((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                        cedula: resp?.cedula || "",
                        cargo: resp?.cargo || "Responsable SST",
                      }));
                    }}
                    disabled={cargandoResponsablesSST}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400/50 appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="" className="bg-slate-800">
                      {cargandoResponsablesSST ? "Cargando..." : "Seleccionar responsable..."}
                    </option>
                    {responsablesSST
                      .filter((r) => r.nombre !== firmaCOPASST.nombre)
                      .map((r) => (
                        <option key={r.id} value={r.nombre} className="bg-slate-800">
                          {r.nombre}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                </div>
                <input
                  type="text"
                  value={firmaSST.cedula}
                  readOnly
                  placeholder="Cédula"
                  className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                />
                <input
                  type="text"
                  value={firmaSST.cargo}
                  readOnly
                  placeholder="Cargo"
                  className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                />
              </div>
              {firmaSST.firma ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Firmado</span>
                  <button
                    onClick={() => setFirmaSST((prev) => ({ ...prev, firma: null }))}
                    className="ml-auto p-1.5 rounded hover:bg-white/10 text-white/40"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setFirmandoGlobal("SST")}
                  disabled={!firmaSST.nombre.trim()}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PenTool className="w-4 h-4" />
                  Firmar
                </button>
              )}
            </div>

            {/* Firma COPASST */}
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <h3 className="text-sm font-semibold text-orange-300 mb-3">Miembro COPASST</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {/* Dropdown de responsables SST */}
                <div className="relative">
                  <select
                    value={firmaCOPASST.nombre}
                    onChange={(e) => {
                      const resp = responsablesSST.find(
                        (r) => r.nombre === e.target.value
                      );
                      setFirmaCOPASST((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                        cedula: resp?.cedula || "",
                        cargo: resp?.cargo || "Miembro COPASST",
                      }));
                    }}
                    disabled={cargandoResponsablesSST}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-orange-400/50 appearance-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="" className="bg-slate-800">
                      {cargandoResponsablesSST ? "Cargando..." : "Seleccionar miembro..."}
                    </option>
                    {responsablesSST
                      .filter((r) => r.nombre !== firmaSST.nombre)
                      .map((r) => (
                        <option key={r.id} value={r.nombre} className="bg-slate-800">
                          {r.nombre}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                </div>
                <input
                  type="text"
                  value={firmaCOPASST.cedula}
                  readOnly
                  placeholder="Cédula"
                  className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                />
                <input
                  type="text"
                  value={firmaCOPASST.cargo}
                  readOnly
                  placeholder="Cargo"
                  className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/40 cursor-not-allowed"
                />
              </div>
              {firmaCOPASST.firma ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Firmado</span>
                  <button
                    onClick={() => setFirmaCOPASST((prev) => ({ ...prev, firma: null }))}
                    className="ml-auto p-1.5 rounded hover:bg-white/10 text-white/40"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setFirmandoGlobal("COPASST")}
                  disabled={!firmaCOPASST.nombre.trim()}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-300 text-sm font-medium hover:bg-orange-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PenTool className="w-4 h-4" />
                  Firmar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap gap-4 text-xs text-white/60">
          <span className="font-medium text-white/80">Leyenda Equipos:</span>
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

      {/* Modal de firma por área */}
      {firmandoArea !== null && (
        <SignatureCanvas
          titulo={`Responsable Área — ${firmandoArea}`}
          onConfirm={confirmarFirmaArea}
          onCancel={() => setFirmandoArea(null)}
        />
      )}

      {/* Modal de firma global (SST / COPASST) */}
      {firmandoGlobal !== null && (
        <SignatureCanvas
          titulo={firmandoGlobal === "SST" ? "Responsable SST" : "Vigía COPASST"}
          onConfirm={confirmarFirmaGlobal}
          onCancel={() => setFirmandoGlobal(null)}
        />
      )}

      {/* Modal de edición/creación de equipo */}
      {modalEquipoAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {equipoEditando ? "Editar Equipo" : "Agregar Nuevo Equipo"}
              </h3>
              <button
                onClick={cerrarModalEquipo}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="p-4 space-y-4">
              {/* Código (solo lectura al editar) / Nombre */}
              {equipoEditando ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-white/50">Código:</span>
                  <span className="text-sm font-mono text-white/80">{formEquipo.codigo}</span>
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formEquipo.nombre || ""}
                  onChange={(e) => setFormEquipo({ ...formEquipo, nombre: e.target.value })}
                  placeholder="Ej: Extintor ABC 10lb"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                />
              </div>

              {/* Categoría y Área */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Categoría <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formEquipo.categoria || "Extintor"}
                    onChange={(e) => setFormEquipo({ ...formEquipo, categoria: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/50"
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#1a1a2e]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Área <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formEquipo.area || ""}
                    onChange={(e) => setFormEquipo({ ...formEquipo, area: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="" className="bg-[#1a1a2e]">Seleccionar...</option>
                    {areas.map((a) => (
                      <option key={a} value={a} className="bg-[#1a1a2e]">
                        {a}
                      </option>
                    ))}
                    {/* Si el área del equipo no está en la lista, mostrarla */}
                    {formEquipo.area && !areas.includes(formEquipo.area) && (
                      <option value={formEquipo.area} className="bg-[#1a1a2e]">
                        {formEquipo.area}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Tipo Específico y Ubicación */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Tipo Específico
                  </label>
                  <input
                    type="text"
                    value={formEquipo.tipoEspecifico || ""}
                    onChange={(e) => setFormEquipo({ ...formEquipo, tipoEspecifico: e.target.value })}
                    placeholder="Ej: ABC, CO2, Polvo Químico"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={formEquipo.ubicacion || ""}
                    onChange={(e) => setFormEquipo({ ...formEquipo, ubicacion: e.target.value })}
                    placeholder="Ej: Pasillo principal"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              {/* Capacidad y Fecha Vencimiento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Capacidad
                  </label>
                  <input
                    type="text"
                    value={formEquipo.capacidad || ""}
                    onChange={(e) => setFormEquipo({ ...formEquipo, capacidad: e.target.value })}
                    placeholder="Ej: 10 lb, 20 unidades"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Fecha Vencimiento
                  </label>
                  <input
                    type="date"
                    value={formEquipo.fechaVencimiento || ""}
                    onChange={(e) => setFormEquipo({ ...formEquipo, fechaVencimiento: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Descripción / Observaciones
                </label>
                <textarea
                  value={formEquipo.descripcion || ""}
                  onChange={(e) => setFormEquipo({ ...formEquipo, descripcion: e.target.value })}
                  placeholder="Notas adicionales sobre el equipo..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>

              {/* Mensaje de error */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-sm text-red-300">{errorMessage}</p>
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={cerrarModalEquipo}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEquipo}
                disabled={guardandoEquipo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardandoEquipo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {equipoEditando ? "Guardar Cambios" : "Crear Equipo"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
