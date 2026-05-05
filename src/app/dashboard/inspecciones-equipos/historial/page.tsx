"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Flame,
  MapPin,
  FileSpreadsheet,
  FileText,
  FileDown,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface InspeccionResumen {
  id: string;
  idInspeccion: string;
  fecha: string;
  inspector: string;
  estado: string;
  observaciones: string;
}

interface DetalleEquipo {
  id: string;
  idDetalle: string;
  categoria: string;
  area: string;
  estadoGeneral: string | null;
  senalizacion: string | null;
  accesibilidad: string | null;
  presionManometro: string | null;
  manguera: string | null;
  pinSeguridad: string | null;
  soporteBase: string | null;
  completitudElementos: string | null;
  estadoContenedor: string | null;
  estructura: string | null;
  correasArnes: string | null;
  fechaVencimiento: string | null;
  observaciones: string;
  fotoUrl: string | null;
  equipoNombre: string;
  equipoCodigo: string;
}

// Mapeo de categoría → código de formato oficial (para menú PDF)
const FORMATO_PDF_POR_CATEGORIA: Record<string, { codigo: string; nombre: string; icono: string }> = {
  "Extintor":     { codigo: "FT-SST-033", nombre: "Extintores",   icono: "🧯" },
  "Botiquin":     { codigo: "FT-SST-032", nombre: "Botiquines",   icono: "🩹" },
  "Camilla":      { codigo: "FT-SST-037", nombre: "Camillas",     icono: "🛏️" },
  "Kit Derrames": { codigo: "FT-SST-050", nombre: "Kit Derrames", icono: "⚠️" },
};
const FORMATO_PDF_DEFAULT = { codigo: "FT-SST-065", nombre: "Equipos", icono: "📄" };

// Normaliza variantes de "Botiquín" para deduplicar en el menú
function normalizarCatUI(cat: string): string {
  return cat === "Botiquín" ? "Botiquin" : cat;
}

// Estilos para estados
const estadoStyles: Record<
  string,
  { IconComp: typeof CheckCircle; color: string; bg: string; border: string }
> = {
  Completada: {
    IconComp: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-500/15",
    border: "border-green-400/25",
  },
  Pendiente: {
    IconComp: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-400/25",
  },
};

const defaultEstadoStyle = {
  IconComp: Clock,
  color: "text-white/50",
  bg: "bg-white/10",
  border: "border-white/15",
};

const CONDICION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Bueno: { bg: "bg-green-500/20", text: "text-green-400", label: "Bueno" },
  Malo:  { bg: "bg-red-500/20",   text: "text-red-400",   label: "Malo" },
  NA:    { bg: "bg-white/10",     text: "text-white/50",  label: "N/A" },
};

const CATEGORIA_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  Extintor:        { color: "text-red-400",    bgColor: "bg-red-500/20",    icon: "🧯" },
  Botiquín:        { color: "text-green-400",  bgColor: "bg-green-500/20",  icon: "🩹" },
  Botiquin:        { color: "text-green-400",  bgColor: "bg-green-500/20",  icon: "🩹" },
  Camilla:         { color: "text-blue-400",   bgColor: "bg-blue-500/20",   icon: "🛏️" },
  "Kit Derrames":  { color: "text-yellow-400", bgColor: "bg-yellow-500/20", icon: "⚠️" },
};

// Etiquetas de estado detallado
const ESTADO_DETALLADO: Record<string, { label: string; color: string }> = {
  B:  { label: "Bueno", color: "text-green-400" },
  R:  { label: "Regular", color: "text-yellow-400" },
  M:  { label: "Malo", color: "text-red-400" },
  NT: { label: "No Tiene", color: "text-white/40" },
};

// Parser para extraer datos detallados de observaciones
interface DatosDetallados {
  criteriosExtintor?: Record<string, { estado: string }>;
  infoExtintor?: { claseAgente: string; tipoExtintor: string; capacidad: string; fechaProximaRecarga: string };
  elementosBotiquin?: Record<string, { estado: string; cantidad: string; fechaVencimiento: string }>;
  elementosKit?: Record<string, { estado: string; cantidad: string; fechaVencimiento: string }>;
  verificacionesKit?: Record<string, { respuesta: boolean }>;
  elementosCamilla?: Record<string, { estado: string }>;
}

function parseDatosDetallados(obs: string): { textoLimpio: string; datos: DatosDetallados | null } {
  const separador = "---DATOS_DETALLADOS---";
  const idx = obs.indexOf(separador);
  if (idx === -1) return { textoLimpio: obs, datos: null };
  const textoLimpio = obs.substring(0, idx).trim();
  const jsonStr = obs.substring(idx + separador.length).trim();
  try {
    const datos = JSON.parse(jsonStr) as DatosDetallados;
    return { textoLimpio, datos };
  } catch {
    return { textoLimpio, datos: null };
  }
}

// Nombres legibles para criterios de extintor
const CRITERIOS_EXTINTOR_NOMBRES: Record<string, string> = {
  presion: "Presión",
  selloGarantia: "Sello de Garantía",
  manometro: "Manómetro",
  estadoCilindro: "Estado del Cilindro",
  manija: "Manija",
  boquillaManguera: "Boquilla o Manguera",
  anilloSeguridad: "Anillo de Seguridad",
  pinSeguridad: "Pin de Seguridad",
  pintura: "Pintura",
  tarjetaInspeccion: "Tarjeta de Inspección",
};

// Nombres legibles para elementos de botiquín
const ELEMENTOS_BOTIQUIN_NOMBRES: Record<string, string> = {
  gasas: "Gasas", esparadrapo: "Esparadrapo", bajalenguas: "Bajalenguas",
  guantesLatex: "Guantes de Latex", aplicadores: "Aplicadores",
  vendaElastica2x5: "Venda elástica 2X5", vendaElastica3x5: "Venda elástica 3X5",
  vendaElastica5x5: "Venda elástica 5X5", vendaAlgodon3x5: "Venda algodón 3X5",
  vendaAlgodon5x5: "Venda algodón 5X5", yodopovidona: "Yodopovidona",
  solucionSalina: "Solución salina", tapabocas: "Tapabocas",
  alcoholAntiseptico: "Alcohol antiséptico", curas: "Curas",
  jeringa5ml: "Jeringa 5ml", tijerasTrauma: "Tijeras de Trauma",
  parcheOcular: "Parche Ocular", termometro: "Termómetro",
  libreta: "Libreta", lapicero: "Lapicero", manualEmergencia: "Manual de Emergencia",
};

// Nombres legibles para elementos de kit de derrames
const ELEMENTOS_KIT_NOMBRES: Record<string, string> = {
  panosAbsorventes: "Paños Absorbentes", barreraAbsorvente: "Barrera Absorbente",
  trajeDesechable: "Traje Desechable", bolsaRoja: "Bolsa Roja",
  palaPlastica: "Pala Plástica", espatulaPlastica: "Espátula Plástica",
  guantesNitrilo: "Guantes de Nitrilo", gafasSeguridad: "Gafas de Seguridad",
  cintaPeligro: "Cinta de Peligro", martilloGoma: "Martillo de Goma",
  recogedorMano: "Recogedor de Mano", respiradorN95: "Respirador N-95",
  linternaRecargable: "Linterna Recargable", bolsaGranulado: "Granulado Absorbente",
  masillaEpoxica: "Masilla Epóxica", desengrasante: "Desengrasante Biodegradable",
  chalecoReflectivo: "Chaleco Reflectivo", conos: "Conos",
};

// Nombres legibles para elementos de camilla
const ELEMENTOS_CAMILLA_NOMBRES: Record<string, string> = {
  estadoPasta: "Estado de la Pasta", correasSeguridad: "Correas de Seguridad",
  sujetadoresCargue: "Sujetadores para Cargue", crucetasSeguridad: "Crucetas de Seguridad",
  inmovilizadorSuperior: "Inmovilizador Superior", inmovilizadorInferior: "Inmovilizador Inferior",
  estadoGeneralCamilla: "Estado General de la Camilla",
};

// Verificaciones del kit de derrames
const VERIFICACIONES_KIT_NOMBRES: Record<string, string> = {
  conoceProcedimiento: "¿El responsable conoce el procedimiento?",
  lugarAdecuado: "¿Almacenado en lugar seco y protegido?",
  rotulado: "¿Kit rotulado o señalizado?",
};

// Helpers
const COLOMBIA_TZ = "America/Bogota";

function formatFecha(iso: string | undefined | null): string {
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

function getCriteriosVisibles(categoria: string) {
  const criterios: { key: string; label: string }[] = [
    { key: "estadoGeneral", label: "Estado General" },
    { key: "senalizacion", label: "Señalización" },
    { key: "accesibilidad", label: "Accesibilidad" },
  ];

  switch (categoria) {
    case "Extintor":
      criterios.push(
        { key: "presionManometro", label: "Presión" },
        { key: "manguera", label: "Manguera" },
        { key: "pinSeguridad", label: "Pin Seg." },
        { key: "soporteBase", label: "Soporte" }
      );
      break;
    case "Kit Derrames":
      criterios.push(
        { key: "completitudElementos", label: "Completitud" },
        { key: "estadoContenedor", label: "Contenedor" }
      );
      break;
    case "Botiquin":
    case "Botiquín":
      criterios.push(
        { key: "completitudElementos", label: "Completitud" },
        { key: "estadoContenedor", label: "Contenedor" }
      );
      break;
    case "Camilla":
      criterios.push(
        { key: "estructura", label: "Estructura" },
        { key: "correasArnes", label: "Correas" }
      );
      break;
  }
  return criterios;
}

// Componente para renderizar datos detallados
function DetalleExtendido({ datos, categoria }: { datos: DatosDetallados; categoria: string }) {
  if (categoria === "Extintor" && datos.criteriosExtintor) {
    const criterios = datos.criteriosExtintor;
    return (
      <div className="mt-2 space-y-2">
        {datos.infoExtintor && (
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">
              Tipo: {datos.infoExtintor.tipoExtintor}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">
              Agente: {datos.infoExtintor.claseAgente}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">
              Capacidad: {datos.infoExtintor.capacidad}
            </span>
            {datos.infoExtintor.fechaProximaRecarga && (
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">
                Próx. recarga: {formatFecha(datos.infoExtintor.fechaProximaRecarga)}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
          {Object.entries(criterios).map(([key, val]) => {
            const est = ESTADO_DETALLADO[val.estado] || { label: val.estado, color: "text-white/40" };
            return (
              <div key={key} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                <span className="text-white/40 truncate">{CRITERIOS_EXTINTOR_NOMBRES[key] || key}:</span>
                <span className={`font-semibold ${est.color}`}>{est.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if ((categoria === "Botiquin" || categoria === "Botiquín") && datos.elementosBotiquin) {
    const elementos = datos.elementosBotiquin;
    return (
      <div className="mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          {Object.entries(elementos).map(([key, val]) => {
            const est = ESTADO_DETALLADO[val.estado] || { label: val.estado, color: "text-white/40" };
            return (
              <div key={key} className="flex items-center justify-between gap-1 px-2 py-0.5 rounded bg-white/5 text-[10px]">
                <span className="text-white/50 truncate">{ELEMENTOS_BOTIQUIN_NOMBRES[key] || key}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white/30">×{val.cantidad}</span>
                  <span className={`font-semibold ${est.color}`}>{est.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (categoria === "Kit Derrames" && (datos.elementosKit || datos.verificacionesKit)) {
    return (
      <div className="mt-2 space-y-2">
        {datos.elementosKit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {Object.entries(datos.elementosKit).map(([key, val]) => {
              const est = ESTADO_DETALLADO[val.estado] || { label: val.estado, color: "text-white/40" };
              return (
                <div key={key} className="flex items-center justify-between gap-1 px-2 py-0.5 rounded bg-white/5 text-[10px]">
                  <span className="text-white/50 truncate">{ELEMENTOS_KIT_NOMBRES[key] || key}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-white/30">×{val.cantidad}</span>
                    <span className={`font-semibold ${est.color}`}>{est.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {datos.verificacionesKit && (
          <div className="space-y-0.5">
            {Object.entries(datos.verificacionesKit).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/5 text-[10px]">
                <span className={`font-semibold ${val.respuesta ? "text-green-400" : "text-red-400"}`}>
                  {val.respuesta ? "✓" : "✗"}
                </span>
                <span className="text-white/50">{VERIFICACIONES_KIT_NOMBRES[key] || key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (categoria === "Camilla" && datos.elementosCamilla) {
    const elementos = datos.elementosCamilla;
    return (
      <div className="mt-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {Object.entries(elementos).map(([key, val]) => {
            const est = ESTADO_DETALLADO[val.estado] || { label: val.estado, color: "text-white/40" };
            return (
              <div key={key} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                <span className="text-white/40 truncate">{ELEMENTOS_CAMILLA_NOMBRES[key] || key}:</span>
                <span className={`font-semibold ${est.color}`}>{est.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function HistorialInspeccionesEquiposPage() {
  const router = useRouter();
  const [inspecciones, setInspecciones] = useState<InspeccionResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  // Expansión y detalle
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detallesCargados, setDetallesCargados] = useState<Record<string, DetalleEquipo[]>>({});
  const [loadingDetalle, setLoadingDetalle] = useState<string | null>(null);

  // Agrupación colapsable: áreas y equipos individuales
  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>({});
  const [expandedEquipos, setExpandedEquipos] = useState<Record<string, boolean>>({});
  const [expandedDetalleEquipos, setExpandedDetalleEquipos] = useState<Record<string, boolean>>({});

  // Exportar
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  // Menú PDF por categoría
  const [pdfMenuOpenId, setPdfMenuOpenId] = useState<string | null>(null);
  const [exportingPdfCat, setExportingPdfCat] = useState<{ id: string; categoria: string } | null>(null);

  // Fetch inspecciones
  const fetchInspecciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inspecciones-equipos");
      const json = await res.json();
      if (json.success) {
        setInspecciones(json.data || []);
      } else {
        setError(json.message || "Error al cargar inspecciones");
      }
    } catch {
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInspecciones();
  }, [fetchInspecciones]);

  // Cargar detalle al expandir
  async function loadDetalle(inspeccionId: string) {
    if (detallesCargados[inspeccionId]) return;

    setLoadingDetalle(inspeccionId);
    try {
      const res = await fetch(`/api/inspecciones-equipos/${inspeccionId}`);
      const json = await res.json();
      if (json.success) {
        setDetallesCargados((prev) => ({
          ...prev,
          [inspeccionId]: json.data?.detalles || [],
        }));
      }
    } catch {
      console.error("Error loading detalle");
    } finally {
      setLoadingDetalle(null);
    }
  }

  // Toggle expansión
  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadDetalle(id);
    }
  }

  // Filtros
  const filtered = inspecciones.filter((insp) => {
    const matchSearch =
      !searchQuery ||
      insp.idInspeccion?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      insp.inspector?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchEstado = filterEstado === "todos" || insp.estado === filterEstado;

    return matchSearch && matchEstado;
  });

  // Contadores
  const totalCompletadas = inspecciones.filter((i) => i.estado === "Completada").length;

  // ── Exportar Excel general ────────────────────────────
  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/inspecciones-equipos/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al exportar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+?)"/);
      a.download = match?.[1] || `Inspecciones_Equipos_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  // ── Exportar PDF general ──────────────────────────────
  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/inspecciones-equipos/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al exportar PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+?)"/);
      a.download = match?.[1] || `Inspecciones_Equipos_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al exportar PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  // ── Exportar Excel individual ─────────────────────────
  async function handleExportIndividual(insp: InspeccionResumen) {
    setExportingId(insp.id);
    try {
      const res = await fetch("/api/inspecciones-equipos/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idInspeccion: insp.idInspeccion }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al exportar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspeccion_Equipos_${insp.idInspeccion}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExportingId(null);
    }
  }

  // ── Exportar PDF individual ───────────────────────────
  async function handleExportPdfIndividual(insp: InspeccionResumen) {
    setExportingPdfId(insp.id);
    try {
      const res = await fetch("/api/inspecciones-equipos/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idInspeccion: insp.idInspeccion }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al exportar PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspeccion_Equipos_${insp.idInspeccion}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al exportar PDF");
    } finally {
      setExportingPdfId(null);
    }
  }

  // ── Exportar PDF individual por categoría ─────────────
  async function handleExportPdfCategoria(insp: InspeccionResumen, categoria: string) {
    setExportingPdfCat({ id: insp.id, categoria });
    try {
      const res = await fetch("/api/inspecciones-equipos/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idInspeccion: insp.idInspeccion, categoria }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al exportar PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspeccion_${categoria.replace(/\s+/g, "_")}_${insp.idInspeccion}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al exportar PDF");
    } finally {
      setExportingPdfCat(null);
    }
  }

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
                onClick={() => router.push("/dashboard/inspecciones-equipos")}
                className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Inspección
              </button>
              <div className="h-8 w-px bg-white/20" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Historial de Inspecciones
                  </h1>
                  <p className="text-xs text-white/50">Equipos de Emergencia</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={exporting || loading || inspecciones.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/15 border border-green-400/25 text-green-300 text-sm font-semibold hover:bg-green-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{exporting ? "Exportando..." : "Excel"}</span>
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf || loading || inspecciones.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-400/25 text-red-300 text-sm font-semibold hover:bg-red-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{exportingPdf ? "Exportando..." : "PDF"}</span>
              </button>
              <button
                onClick={fetchInspecciones}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm hover:bg-white/20 transition-all cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/50 mb-1">Total Inspecciones</p>
            <p className="text-2xl font-bold text-white">{inspecciones.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/50 mb-1">Completadas</p>
            <p className="text-2xl font-bold text-green-400">{totalCompletadas}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-white/50 mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-amber-400">
              {inspecciones.length - totalCompletadas}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID o inspector..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/90 placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/90 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
          >
            <option value="todos" className="bg-slate-800">
              Todos los estados
            </option>
            <option value="Completada" className="bg-slate-800">
              Completadas
            </option>
            <option value="Pendiente" className="bg-slate-800">
              Pendientes
            </option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm flex-1">{error}</p>
            <button
              onClick={fetchInspecciones}
              className="px-3 py-1 rounded-lg bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-all cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <Flame className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No se encontraron inspecciones</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((insp) => {
              const estilo = estadoStyles[insp.estado] || defaultEstadoStyle;
              const { IconComp } = estilo;
              const isExpanded = expandedId === insp.id;
              const detalles = detallesCargados[insp.id];

              return (
                <div
                  key={insp.id}
                  className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
                >
                  {/* Row principal */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(insp.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(insp.id); } }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors cursor-pointer text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg ${estilo.bg} border ${estilo.border} flex items-center justify-center shrink-0`}>
                      <IconComp className={`w-5 h-5 ${estilo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {insp.idInspeccion || "Sin ID"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${estilo.bg} ${estilo.color} border ${estilo.border}`}>
                          {insp.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatFecha(insp.fecha)}
                        </span>
                        <span>Inspector: {insp.inspector || "—"}</span>
                      </div>
                    </div>
                    {/* Botones de exportación individual */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportIndividual(insp);
                        }}
                        disabled={exportingId === insp.id}
                        className="p-1.5 rounded-lg bg-green-500/15 border border-green-400/25 text-green-400 hover:bg-green-500/25 transition-all disabled:opacity-50 cursor-pointer"
                        title="Exportar Excel"
                      >
                        {exportingId === insp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pdfMenuOpenId === insp.id) {
                            setPdfMenuOpenId(null);
                          } else {
                            setPdfMenuOpenId(insp.id);
                            if (!detallesCargados[insp.id]) {
                              loadDetalle(insp.id);
                            }
                          }
                        }}
                        disabled={exportingPdfId === insp.id}
                        className={`p-1.5 rounded-lg border text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-50 cursor-pointer ${
                          pdfMenuOpenId === insp.id
                            ? "bg-red-500/30 border-red-400/50"
                            : "bg-red-500/15 border-red-400/25"
                        }`}
                        title="Exportar PDF por tipo de equipo"
                      >
                        {exportingPdfId === insp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </button>
                      <div className={`p-1.5 rounded-lg ${isExpanded ? "bg-red-500/20" : "bg-white/10"} transition-all`}>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-red-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menú PDF por tipo de equipo */}
                  {pdfMenuOpenId === insp.id && (
                    <div className="border-t border-red-400/20 bg-red-500/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-white/40 shrink-0">Descargar informe por tipo:</span>
                        {loadingDetalle === insp.id ? (
                          <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                        ) : !detallesCargados[insp.id] || detallesCargados[insp.id].length === 0 ? (
                          <span className="text-xs text-white/40 italic">Sin detalles disponibles</span>
                        ) : (
                          (() => {
                            const categorias = [
                              ...new Set(
                                detallesCargados[insp.id].map((d) => normalizarCatUI(d.categoria)).filter(Boolean)
                              ),
                            ];
                            return categorias.map((cat) => {
                              const fmt = FORMATO_PDF_POR_CATEGORIA[cat] ?? FORMATO_PDF_DEFAULT;
                              const isLoadingThis =
                                exportingPdfCat?.id === insp.id &&
                                normalizarCatUI(exportingPdfCat.categoria) === cat;
                              return (
                                <button
                                  key={cat}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportPdfCategoria(insp, cat);
                                  }}
                                  disabled={!!exportingPdfCat}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-400/25 text-red-300 text-xs font-medium hover:bg-red-500/25 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {isLoadingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {fmt.icono} {fmt.nombre}
                                  </span>
                                  <span className="text-red-400/60 text-[10px]">{fmt.codigo}</span>
                                </button>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="border-t border-white/10">
                      {loadingDetalle === insp.id ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                        </div>
                      ) : !detalles || detalles.length === 0 ? (
                        <div className="p-6 text-center text-white/40 text-sm">
                          No se encontraron detalles para esta inspección
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {/* Resumen rápido por categoría */}
                          {(() => {
                            const porCategoria = detalles.reduce((acc, det) => {
                              const cat = det.categoria || "Otro";
                              if (!acc[cat]) acc[cat] = { total: 0, buenos: 0, malos: 0 };
                              acc[cat].total++;
                              if (det.estadoGeneral === "Bueno") acc[cat].buenos++;
                              if (det.estadoGeneral === "Malo") acc[cat].malos++;
                              return acc;
                            }, {} as Record<string, { total: number; buenos: number; malos: number }>);

                            return (
                              <div className="flex flex-wrap gap-2 mb-1">
                                <span className="text-[10px] text-white/40 self-center">Resumen:</span>
                                {Object.entries(porCategoria).map(([cat, stats]) => {
                                  const cfg = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.Extintor;
                                  return (
                                    <span key={cat} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${cfg.bgColor} text-[10px]`}>
                                      <span>{cfg.icon}</span>
                                      <span className={`font-semibold ${cfg.color}`}>{stats.total} {cat}</span>
                                      {stats.buenos > 0 && <span className="text-green-400">✓{stats.buenos}</span>}
                                      {stats.malos > 0 && <span className="text-red-400">✗{stats.malos}</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Agrupar por área — colapsable */}
                          {Object.entries(
                            detalles.reduce(
                              (acc, det) => {
                                const area = det.area || "Sin Área";
                                if (!acc[area]) acc[area] = [];
                                acc[area].push(det);
                                return acc;
                              },
                              {} as Record<string, DetalleEquipo[]>
                            )
                          )
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([area, equiposArea]) => {
                              const areaKey = `${insp.id}-${area}`;
                              const isAreaCollapsed = collapsedAreas[areaKey] === true;
                              // Resumen de estados por área
                              const areaBuenos = equiposArea.filter(e => e.estadoGeneral === "Bueno").length;
                              const areaMalos = equiposArea.filter(e => e.estadoGeneral === "Malo").length;

                              return (
                              <div
                                key={area}
                                className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                              >
                                <button
                                  onClick={() => setCollapsedAreas(prev => ({ ...prev, [areaKey]: !prev[areaKey] }))}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/8 transition-colors cursor-pointer text-left"
                                >
                                  <MapPin className="w-4 h-4 text-white/50 shrink-0" />
                                  <span className="text-sm font-semibold text-white/80 flex-1">
                                    {area}
                                  </span>
                                  <span className="text-xs text-white/40">
                                    {equiposArea.length} equipo{equiposArea.length > 1 ? "s" : ""}
                                  </span>
                                  {areaBuenos > 0 && (
                                    <span className="text-[10px] text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">✓{areaBuenos}</span>
                                  )}
                                  {areaMalos > 0 && (
                                    <span className="text-[10px] text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">✗{areaMalos}</span>
                                  )}
                                  {isAreaCollapsed ? (
                                    <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                                  )}
                                </button>

                                {!isAreaCollapsed && (
                                <div className="divide-y divide-white/5">
                                  {equiposArea.map((det) => {
                                    const catCfg =
                                      CATEGORIA_CONFIG[det.categoria] || CATEGORIA_CONFIG.Extintor;
                                    const criterios = getCriteriosVisibles(det.categoria);
                                    const { textoLimpio, datos } = parseDatosDetallados(det.observaciones);
                                    const equipoKey = `${insp.id}-${det.id}`;
                                    const isEquipoExpanded = expandedEquipos[equipoKey] === true;
                                    const detalleKey = `${insp.id}-${det.id}-det`;
                                    const isDetalleExpanded = expandedDetalleEquipos[detalleKey] === true;

                                    // Estado resumen rápido
                                    const estadoStyle = det.estadoGeneral
                                      ? CONDICION_STYLES[det.estadoGeneral] || { bg: "bg-white/5", text: "text-white/30", label: det.estadoGeneral }
                                      : { bg: "bg-white/5", text: "text-white/20", label: "—" };

                                    return (
                                      <div key={det.id} className="px-4 py-2">
                                        {/* Fila resumen del equipo — siempre visible, clickeable */}
                                        <button
                                          onClick={() => setExpandedEquipos(prev => ({ ...prev, [equipoKey]: !prev[equipoKey] }))}
                                          className="w-full flex items-center gap-2 text-left cursor-pointer hover:opacity-80 transition-opacity py-0.5"
                                        >
                                          <span className="text-sm shrink-0">{catCfg.icon}</span>
                                          <span className="text-xs font-medium text-white truncate flex-1">
                                            {det.equipoNombre || det.equipoCodigo || det.idDetalle}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${catCfg.bgColor} ${catCfg.color} shrink-0`}>
                                            {det.categoria}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${estadoStyle.bg} ${estadoStyle.text} shrink-0`}>
                                            {estadoStyle.label}
                                          </span>
                                          {det.fechaVencimiento && (
                                            <span className="text-[9px] text-white/30 shrink-0 hidden sm:inline">
                                              Vence: {formatFecha(det.fechaVencimiento)}
                                            </span>
                                          )}
                                          {isEquipoExpanded ? (
                                            <ChevronUp className="w-3.5 h-3.5 text-white/25 shrink-0" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-white/25 shrink-0" />
                                          )}
                                        </button>

                                        {/* Detalle expandido del equipo */}
                                        {isEquipoExpanded && (
                                          <div className="mt-2 ml-6 space-y-2">
                                            {/* Criterios generales en pills */}
                                            <div className="flex flex-wrap gap-1.5">
                                              {criterios.map((c) => {
                                                const val = det[c.key as keyof DetalleEquipo] as string | null;
                                                const style = val
                                                  ? CONDICION_STYLES[val] || { bg: "bg-white/5", text: "text-white/30", label: val }
                                                  : { bg: "bg-white/5", text: "text-white/20", label: "—" };

                                                return (
                                                  <span
                                                    key={c.key}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${style.bg}`}
                                                    title={c.label}
                                                  >
                                                    <span className="text-white/40">{c.label}:</span>
                                                    <span className={`font-semibold ${style.text}`}>{style.label}</span>
                                                  </span>
                                                );
                                              })}
                                            </div>

                                            {/* Botón para ver detalle extendido */}
                                            {datos && (
                                              <div>
                                                <button
                                                  onClick={() => setExpandedDetalleEquipos(prev => ({ ...prev, [detalleKey]: !prev[detalleKey] }))}
                                                  className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                                                >
                                                  {isDetalleExpanded ? (
                                                    <ChevronUp className="w-3 h-3" />
                                                  ) : (
                                                    <ChevronDown className="w-3 h-3" />
                                                  )}
                                                  <span>
                                                    {isDetalleExpanded ? "Ocultar" : "Ver"} detalle de inspección
                                                  </span>
                                                </button>
                                                {isDetalleExpanded && (
                                                  <DetalleExtendido datos={datos} categoria={det.categoria} />
                                                )}
                                              </div>
                                            )}

                                            {/* Observaciones */}
                                            {textoLimpio && (
                                              <p className="text-[10px] text-white/40">
                                                📝 {textoLimpio}
                                              </p>
                                            )}

                                            {/* Foto de evidencia */}
                                            {det.fotoUrl && (
                                              <a
                                                href={det.fotoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block mt-1"
                                                title="Ver evidencia fotográfica"
                                              >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                  src={det.fotoUrl}
                                                  alt="Evidencia"
                                                  className="w-16 h-16 object-cover rounded-lg border border-white/20 hover:opacity-80 transition-opacity"
                                                />
                                              </a>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                )}
                              </div>
                              );
                            })}
                        </div>
                      )}
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
