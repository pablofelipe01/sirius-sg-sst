"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  Search,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Package,
  User,
  ShieldCheck,
  AlertTriangle,
  X,
  Fingerprint,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  PenLine,
  Eraser,
  Save,
  Camera,
  ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { guardarEnGaleria } from "@/shared/utils";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface DetalleEntrega {
  id: string;
  cantidad: number;
  talla: string;
  condicion: string;
  codigoInsumo: string;
  nombreInsumo: string;
}

interface TokenEntrega {
  id: string;
  tokenId: string;
  estado: string;
  hashFirma: string;
  idEmpleadoCore: string;
  fechaGeneracion: string;
}

interface EntregaEPP {
  id: string;
  idEntrega: string;
  fechaEntrega: string;
  responsable: string;
  observaciones: string;
  fechaConfirmacion: string;
  idEmpleadoCore: string;
  nombreEmpleado: string;
  estado: string;
  motivo: string;
  fotoEvidenciaUrl: string;
  detalles: DetalleEntrega[];
  tokens: TokenEntrega[];
}

interface FirmaDescifrada {
  signatureDataUrl: string;
  employee: string;
  document: string;
  timestamp: string;
  tokenRecord: string;
}

// ══════════════════════════════════════════════════════════
// Helpers - Timezone Colombia
// ══════════════════════════════════════════════════════════
const COLOMBIA_TZ = "America/Bogota";

function formatFecha(iso: string): string {
  if (!iso) return "—";
  try {
    // Si es solo fecha YYYY-MM-DD, añadir mediodía para evitar desfase UTC
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

function formatFechaHora(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: COLOMBIA_TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const estadoStyles: Record<
  string,
  { IconComp: typeof CheckCircle; color: string; bg: string; border: string; spin?: boolean }
> = {
  Confirmada: {
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
  Anulada: {
    IconComp: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-400/25",
  },
  "En Proceso": {
    IconComp: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-400/25",
    spin: true,
  },
};

const defaultEstadoStyle = {
  IconComp: Clock,
  color: "text-white/50",
  bg: "bg-white/10",
  border: "border-white/15",
};

// ══════════════════════════════════════════════════════════
// Gestión de fotos de evidencia por entrega
// ══════════════════════════════════════════════════════════
function GestorFotos({
  entrega,
  onUpdated,
}: {
  entrega: EntregaEPP;
  onUpdated: () => void;
}) {
  const currentUrls = entrega.fotoEvidenciaUrl
    ? entrega.fotoEvidenciaUrl.split(",").map((u) => u.trim()).filter(Boolean)
    : [];

  const [uploading, setUploading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetIndexRef = useRef<number>(0);

  const handleSelectFile = (index: number) => {
    targetIndexRef.current = index;
    setError(null);
    setSuccess(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const idx = targetIndexRef.current;

    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen excede 10 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Formato no permitido. Use JPG, PNG o WebP");
      return;
    }

    guardarEnGaleria(file);
    setUploading(idx);
    setError(null);
    setSuccess(null);

    try {
      // Subir la foto a través del API server (FormData)
      // Esto evita problemas de CORS con S3 y es más confiable
      const formData = new FormData();
      formData.append("entregaRecordId", entrega.id);
      formData.append("index", String(idx));
      formData.append("foto", file);

      const res = await fetch("/api/entregas-epp/foto-evidencia/actualizar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Error del servidor (${res.status}): ${errText}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const action = idx < currentUrls.length ? "actualizada" : "agregada";
      setSuccess(`Foto ${idx + 1} ${action} exitosamente`);
      onUpdated();
    } catch (err) {
      console.error("Error en GestorFotos:", err);
      setError(err instanceof Error ? err.message : "Error al procesar la foto");
    } finally {
      setUploading(null);
    }
  };

  const handleDeletePhoto = async (idx: number) => {
    setDeleting(idx);
    setConfirmDelete(null);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/entregas-epp/foto-evidencia/actualizar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entregaRecordId: entrega.id,
          index: idx,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Error del servidor (${res.status}): ${errText}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setSuccess(`Foto ${idx + 1} eliminada exitosamente`);
      onUpdated();
    } catch (err) {
      console.error("Error eliminando foto:", err);
      setError(err instanceof Error ? err.message : "Error al eliminar la foto");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-white/5">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" />
        Fotos de evidencia
        <span className="text-[10px] font-normal text-white/30 ml-1">
          ({currentUrls.length}/3)
        </span>
      </h3>

      <div className="grid grid-cols-3 gap-2">
        {/* Slots de fotos (siempre mostrar 3) */}
        {[0, 1, 2].map((idx) => {
          const url = currentUrls[idx];
          const isUploading = uploading === idx;
          const isDeleting = deleting === idx;
          const isConfirming = confirmDelete === idx;

          return (
            <div key={idx} className="relative">
              {url ? (
                // Foto existente
                <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-square group">
                  <img
                    src={url}
                    alt={`Evidencia ${idx + 1}`}
                    className="w-full h-full object-cover bg-black/30"
                  />
                  {isConfirming ? (
                    // Overlay de confirmación de eliminación
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
                      <p className="text-[10px] text-white/80 text-center px-2">¿Eliminar esta foto?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeletePhoto(idx)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-[10px] font-medium hover:bg-red-600 transition-all cursor-pointer"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-[10px] font-medium hover:bg-white/30 transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : isDeleting ? (
                    // Overlay de cargando eliminación
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                    </div>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {/* Botón reemplazar */}
                  <button
                    onClick={() => handleSelectFile(idx)}
                    disabled={isUploading || isDeleting || isConfirming}
                    className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-lg bg-blue-500/80 border border-blue-400/40 flex items-center justify-center text-white hover:bg-blue-600 transition-all cursor-pointer disabled:opacity-50 z-20"
                    title="Reemplazar esta foto"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {/* Botón eliminar */}
                  <button
                    onClick={() => { setConfirmDelete(idx); setError(null); setSuccess(null); }}
                    disabled={isUploading || isDeleting || isConfirming}
                    className="absolute bottom-1.5 left-1.5 w-8 h-8 rounded-lg bg-red-500/80 border border-red-400/40 flex items-center justify-center text-white hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50 z-20"
                    title="Eliminar esta foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/70 z-20">
                    Foto {idx + 1}
                  </div>
                </div>
              ) : (
                // Slot vacío — click para agregar
                <button
                  onClick={() => handleSelectFile(idx)}
                  disabled={isUploading || (idx > 0 && !currentUrls[idx - 1])}
                  className="border-2 border-dashed border-white/10 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-orange-400/20 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed w-full"
                  title={idx > 0 && !currentUrls[idx - 1] ? "Agregue la foto anterior primero" : "Agregar foto"}
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 text-orange-400/50 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-white/15 mb-1" />
                      <p className="text-[10px] text-white/25">Agregar</p>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mensajes */}
      {success && (
        <p className="text-[10px] text-green-400 flex items-center gap-1 mt-2">
          <CheckCircle className="w-3 h-3" /> {success}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-red-400 flex items-center gap-1 mt-2">
          <XCircle className="w-3 h-3" /> {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Pad de firma inline por entrega
// ══════════════════════════════════════════════════════════
function PadFirma({
  entrega,
  onSuccess,
}: {
  entrega: EntregaEPP;
  onSuccess: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [firmaError, setFirmaError] = useState<string | null>(null);
  const [firmaExito, setFirmaExito] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujandoRef = useRef(false);
  const hasTrazosRef = useRef(false);

  const puedeFirmar =
    entrega.estado === "Pendiente" || entrega.estado === "Confirmada";

  if (!puedeFirmar) return null;

  const esActualizacion = entrega.estado === "Confirmada";

  // ── Helpers canvas ──────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dibujandoRef.current = true;
    hasTrazosRef.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dibujandoRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    dibujandoRef.current = false;
  };

  const limpiarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasTrazosRef.current = false;
  };

  const initCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    // eslint-disable-next-line react-compiler/react-compiler
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a33";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const handleAbrir = () => {
    setAbierto(true);
    setFirmaError(null);
    setFirmaExito(false);
    hasTrazosRef.current = false;
  };

  const handleGuardar = async () => {
    if (!canvasRef.current || !hasTrazosRef.current) {
      setFirmaError("Debe dibujar su firma antes de guardar");
      return;
    }
    setGuardando(true);
    setFirmaError(null);
    try {
      const signatureData = canvasRef.current.toDataURL("image/png");
      const res = await fetch("/api/entregas-epp/firmar-directo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregaId: entrega.id, signatureData }),
      });
      const json = await res.json();
      if (json.success) {
        setFirmaExito(true);
        setAbierto(false);
        onSuccess();
      } else {
        setFirmaError(json.message || "Error al guardar la firma");
      }
    } catch {
      setFirmaError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Botón abrir pad */}
      {!abierto && (
        <button
          onClick={handleAbrir}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            esActualizacion
              ? "bg-blue-500/15 border border-blue-400/25 text-blue-300 hover:bg-blue-500/25"
              : "bg-amber-500/15 border border-amber-400/25 text-amber-300 hover:bg-amber-500/25"
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          {esActualizacion ? "Actualizar firma" : "Cargar firma"}
        </button>
      )}

      {/* Pad de firma inline */}
      {abierto && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/70">
              {esActualizacion ? "Actualizar firma" : "Dibujar firma"}
            </p>
            <button
              onClick={() => setAbierto(false)}
              className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white/40 hover:bg-white/20 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="rounded-lg overflow-hidden border border-white/15 bg-white">
            <canvas
              ref={initCanvas}
              width={600}
              height={180}
              className="w-full h-auto cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={limpiarCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white/60 text-xs font-medium hover:bg-white/15 transition-all cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5" />
              Limpiar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/25 text-green-300 text-xs font-semibold hover:bg-green-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Guardar firma
            </button>
          </div>
        </div>
      )}

      {/* Éxito */}
      {firmaExito && (
        <p className="text-[10px] text-green-400 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {esActualizacion ? "Firma actualizada exitosamente" : "Firma registrada exitosamente"}
        </p>
      )}

      {/* Error */}
      {firmaError && (
        <p className="text-[10px] text-red-400 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {firmaError}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function EntregasListPage() {
  const router = useRouter();
  const [entregas, setEntregas] = useState<EntregaEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal de firma
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenEntrega | null>(null);
  const [selectedEntregaId, setSelectedEntregaId] = useState<string>("");
  const [firmaDescifrada, setFirmaDescifrada] = useState<FirmaDescifrada | null>(null);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [decryptError, setDecryptError] = useState("");

  // Exportar Excel / PDF
  const [exportingTipo, setExportingTipo] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportMes, setExportMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exportEmpleado, setExportEmpleado] = useState<string>("");

  // ── Fetch entregas ────────────────────────────────────
  const fetchEntregas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/entregas-epp");
      const json = await res.json();
      if (json.success) {
        setEntregas(json.data);
      } else {
        setError(json.message || "Error al cargar entregas");
      }
    } catch {
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  // ── Descifrar firma automáticamente ────────────────────
  const openFirmaModal = async (token: TokenEntrega, entregaId: string) => {
    setSelectedToken(token);
    setSelectedEntregaId(entregaId);
    setFirmaDescifrada(null);
    setDecryptError("");
    setShowFirmaModal(true);
    setDecryptLoading(true);

    try {
      const res = await fetch("/api/entregas-epp/descifrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashFirma: token.hashFirma }),
      });

      const json = await res.json();

      if (!json.success) {
        setDecryptError(json.message || "Error al descifrar");
        return;
      }

      setFirmaDescifrada(json.firma);
    } catch {
      setDecryptError("Error de conexión");
    } finally {
      setDecryptLoading(false);
    }
  };

  const closeFirmaModal = () => {
    setShowFirmaModal(false);
    setSelectedToken(null);
    setFirmaDescifrada(null);
    setDecryptError("");
  };

  // ── Exportar Excel ────────────────────────────────────
  const handleExportExcel = async (tipo: "epp" | "dotacion") => {
    setExportingTipo(tipo);
    try {
      const params = new URLSearchParams({ tipo });
      if (exportMes) params.set("mes", exportMes);
      const fetchUrl = `/api/entregas-epp/exportar?${params.toString()}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al generar el archivo");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+?)"/);
      a.download = match?.[1] || `Entregas_${tipo === "dotacion" ? "Dotacion" : "EPP"}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error exporting:", err);
      setError(err instanceof Error ? err.message : "Error al exportar las entregas a Excel");
    } finally {
      setExportingTipo(null);
    }
  };

  // ── Exportar PDF ──────────────────────────────────────
  const handleExportPdf = async () => {
    setExportingPdf(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tipo: "dotacion", mes: exportMes });
      if (exportEmpleado) params.set("idEmpleado", exportEmpleado);
      const res = await fetch(`/api/entregas-epp/exportar-pdf?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Error al generar el PDF");
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+?)"/);
      a.download = match?.[1] || `Entregas_Dotacion_${exportMes}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      setError(err instanceof Error ? err.message : "Error al exportar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  // Lista única de empleados a partir de las entregas cargadas
  const empleadosUnicos = useMemo(() => {
    const map = new Map<string, string>();
    for (const ent of entregas) {
      if (ent.idEmpleadoCore && ent.nombreEmpleado) {
        map.set(ent.idEmpleadoCore, ent.nombreEmpleado);
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [entregas]);

  // ── Filtros ───────────────────────────────────────────
  const filtered = entregas.filter((ent) => {
    const matchSearch =
      !searchQuery ||
      ent.idEntrega.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.idEmpleadoCore.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.nombreEmpleado.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.responsable.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.motivo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.observaciones.toLowerCase().includes(searchQuery.toLowerCase());

    const matchEstado =
      filterEstado === "todos" || ent.estado === filterEstado;

    return matchSearch && matchEstado;
  });

  // ── Contadores ────────────────────────────────────────
  const totalConfirmadas = entregas.filter((e) => e.estado === "Confirmada").length;
  const totalPendientes = entregas.filter((e) => e.estado === "Pendiente").length;
  const totalConFirma = entregas.filter((e) =>
    e.tokens.some((t) => t.hashFirma && t.estado === "Usado")
  ).length;

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
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
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Entregas de EPP
                  </h1>
                  <p className="text-xs text-white/50">
                    {entregas.length} entrega{entregas.length !== 1 ? "s" : ""}{" "}
                    registrada{entregas.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={exportMes}
                onChange={(e) => setExportMes(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-400/40 [color-scheme:dark]"
              />
              <button
                onClick={() => handleExportExcel("epp")}
                disabled={!!exportingTipo || loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/15 border border-green-400/25 text-green-300 text-sm font-semibold hover:bg-green-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportingTipo === "epp" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {exportingTipo === "epp" ? "Exportando..." : "EPP"}
                </span>
              </button>
              <button
                onClick={() => handleExportExcel("dotacion")}
                disabled={!!exportingTipo || loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-400/25 text-purple-300 text-sm font-semibold hover:bg-purple-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportingTipo === "dotacion" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {exportingTipo === "dotacion" ? "Exportando..." : "Dotación"}
                </span>
              </button>
              <button
                onClick={fetchEntregas}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm hover:bg-white/20 transition-all cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── KPIs ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4">
            <p className="text-[11px] text-white/40 mb-1">Total</p>
            <p className="text-2xl font-bold text-white">{entregas.length}</p>
          </div>
          <div className="bg-green-500/10 backdrop-blur-xl rounded-xl border border-green-400/20 p-4">
            <p className="text-[11px] text-green-300/60 mb-1">Confirmadas</p>
            <p className="text-2xl font-bold text-green-400">
              {totalConfirmadas}
            </p>
          </div>
          <div className="bg-amber-500/10 backdrop-blur-xl rounded-xl border border-amber-400/20 p-4">
            <p className="text-[11px] text-amber-300/60 mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-amber-400">
              {totalPendientes}
            </p>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl border border-blue-400/20 p-4">
            <p className="text-[11px] text-blue-300/60 mb-1">Con firma</p>
            <p className="text-2xl font-bold text-blue-400">{totalConFirma}</p>
          </div>
        </div>

        {/* ── Búsqueda y filtros ──────────────────────── */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar por ID, empleado, responsable, motivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-400/50 transition-all"
              />
            </div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-all cursor-pointer appearance-none"
            >
              <option value="todos" className="bg-gray-900">
                Todos los estados
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
              <option value="En Proceso" className="bg-gray-900">
                En Proceso
              </option>
            </select>
          </div>
        </div>

        {/* ── Panel exportar PDF Dotación ──────────────── */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-white/70 font-semibold shrink-0">
              <FileText className="w-4 h-4 text-red-400" />
              PDF Dotación
            </div>
            <input
              type="month"
              value={exportMes}
              onChange={(e) => setExportMes(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-red-400/50 transition-all [color-scheme:dark]"
            />
            <select
              value={exportEmpleado}
              onChange={(e) => setExportEmpleado(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-red-400/50 transition-all appearance-none"
            >
              <option value="" className="bg-gray-900">
                Todos los empleados
              </option>
              {empleadosUnicos.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-gray-900">
                  {emp.nombre}
                </option>
              ))}
            </select>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-400/25 text-red-300 text-sm font-semibold hover:bg-red-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {exportingPdf ? "Generando..." : "Generar PDF"}
            </button>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────── */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={fetchEntregas}
              className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition-all cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Sin resultados ──────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-white/15 mx-auto mb-4" />
            <p className="text-white/40 text-sm">
              {entregas.length === 0
                ? "No hay entregas registradas"
                : "No se encontraron entregas con esos filtros"}
            </p>
          </div>
        )}

        {/* ── Lista de entregas ───────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((ent) => {
              const est = estadoStyles[ent.estado] || defaultEstadoStyle;
              const isExpanded = expandedId === ent.id;
              const tieneFirma = ent.tokens.some(
                (t) => t.hashFirma && t.estado === "Usado"
              );

              return (
                <div
                  key={ent.id}
                  className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 overflow-hidden transition-all"
                >
                  {/* Cabecera */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-all"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : ent.id)
                    }
                  >
                    {/* Estado badge */}
                    <div
                      className={`w-9 h-9 rounded-lg ${est.bg} border ${est.border} flex items-center justify-center ${est.color} shrink-0`}
                    >
                      <est.IconComp className={`w-3.5 h-3.5 ${est.spin ? "animate-spin" : ""}`} />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white truncate">
                          {ent.idEntrega || ent.id.slice(0, 10)}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${est.bg} ${est.color} border ${est.border}`}
                        >
                          {ent.estado}
                        </span>
                        {tieneFirma && (
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-400 text-[10px] font-semibold flex items-center gap-0.5">
                            <Fingerprint className="w-3 h-3" />
                            Firmada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/40">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ent.nombreEmpleado || ent.idEmpleadoCore}
                        </span>
                        <span>{formatFecha(ent.fechaEntrega)}</span>
                        <span className="hidden sm:inline">
                          {ent.motivo}
                        </span>
                      </div>
                    </div>

                    {/* EPPs count */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-white/50">
                        {ent.detalles.length} EPP
                        {ent.detalles.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {ent.detalles.reduce(
                          (a, d) => a + d.cantidad,
                          0
                        )}{" "}
                        uds
                      </p>
                    </div>

                    <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expandido: detalles */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                        {/* Info general */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                            Información
                          </h3>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-white/40 w-28 shrink-0">
                                Responsable:
                              </span>
                              <span className="text-white font-medium">
                                {ent.responsable || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-white/40 w-28 shrink-0">
                                Motivo:
                              </span>
                              <span className="text-white font-medium">
                                {ent.motivo || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-white/40 w-28 shrink-0">
                                Fecha entrega:
                              </span>
                              <span className="text-white font-medium">
                                {formatFecha(ent.fechaEntrega)}
                              </span>
                            </div>
                            {ent.fechaConfirmacion && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-white/40 w-28 shrink-0">
                                  Confirmación:
                                </span>
                                <span className="text-green-400 font-medium">
                                  {formatFecha(ent.fechaConfirmacion)}
                                </span>
                              </div>
                            )}
                            {ent.observaciones && (
                              <div className="flex items-start gap-2 text-xs">
                                <span className="text-white/40 w-28 shrink-0 pt-0.5">
                                  Notas:
                                </span>
                                <span className="text-white/70 italic">
                                  {ent.observaciones}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EPPs entregados */}
                        <div>
                          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                            EPPs Entregados
                          </h3>
                          <div className="space-y-1.5">
                            {ent.detalles.map((det) => (
                              <div
                                key={det.id}
                                className="flex items-center gap-2.5 bg-white/5 rounded-lg border border-white/5 px-3 py-2"
                              >
                                <Package className="w-4 h-4 text-orange-400/60 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">
                                    {det.nombreInsumo}
                                  </p>
                                  <p className="text-[10px] text-white/30">
                                    {det.condicion} · Talla:{" "}
                                    {det.talla}
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-orange-300">
                                  ×{det.cantidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Fotos de evidencia — Gestión */}
                      <GestorFotos entrega={ent} onUpdated={fetchEntregas} />

                      {/* Tokens / Firmas */}
                      {ent.tokens.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verificación y Firma
                          </h3>
                          <div className="space-y-2">
                            {ent.tokens.map((tok) => {
                              const hasFirma =
                                tok.hashFirma && tok.estado === "Usado";
                              return (
                                <div
                                  key={tok.id}
                                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                                    hasFirma
                                      ? "bg-green-500/5 border-green-400/15"
                                      : "bg-white/5 border-white/10"
                                  }`}
                                >
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      hasFirma
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-amber-500/15 text-amber-400"
                                    }`}
                                  >
                                    {hasFirma ? (
                                      <Fingerprint className="w-4 h-4" />
                                    ) : (
                                      <Clock className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white">
                                      {hasFirma
                                        ? "Firma digital registrada"
                                        : "Firma pendiente"}
                                    </p>
                                    <p className="text-[10px] text-white/30 font-mono">
                                      Token: {tok.tokenId.slice(0, 12)}…
                                      {" · "}
                                      {tok.idEmpleadoCore}
                                    </p>
                                  </div>

                                  {/* Estado del token */}
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      tok.estado === "Usado"
                                        ? "bg-green-500/15 text-green-400 border border-green-400/25"
                                        : tok.estado === "Activo"
                                        ? "bg-amber-500/15 text-amber-400 border border-amber-400/25"
                                        : "bg-red-500/15 text-red-400 border border-red-400/25"
                                    }`}
                                  >
                                    {tok.estado}
                                  </span>

                                  {/* Botón ver firma */}
                                  {hasFirma && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openFirmaModal(tok, ent.idEntrega);
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-semibold hover:bg-blue-500/25 transition-all cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver firma
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Info cifrado */}
                          {ent.tokens.some(
                            (t) => t.hashFirma && t.estado === "Usado"
                          ) && (
                            <div className="mt-2 flex items-center gap-2 bg-blue-500/5 border border-blue-400/10 rounded-lg px-3 py-2">
                              <ShieldCheck className="w-3 h-3 text-blue-400/50" />
                              <p className="text-[10px] text-blue-300/40">
                                Firma protegida con cifrado AES-256-CBC.
                              </p>
                            </div>
                          )}

                          {/* Pad de firma inline */}
                          <PadFirma
                            entrega={ent}
                            onSuccess={fetchEntregas}
                          />
                        </div>
                      )}

                      {/* Pad de firma si no hay tokens aún */}
                      {ent.tokens.length === 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <PadFirma
                            entrega={ent}
                            onSuccess={fetchEntregas}
                          />
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

      {/* ═══ MODAL: DESCIFRAR FIRMA ═══ */}
      {showFirmaModal && selectedToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeFirmaModal}
        >
          <div
            className="bg-gray-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Firma digital
                  </h3>
                  <p className="text-[10px] text-white/40">
                    Entrega {selectedEntregaId} · Token:{" "}
                    {selectedToken.tokenId.slice(0, 12)}…
                  </p>
                </div>
              </div>
              <button
                onClick={closeFirmaModal}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              {decryptLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                  <p className="text-sm text-white/50">Descifrando firma con AES-256-CBC...</p>
                </div>
              ) : decryptError ? (
                <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-300 font-medium mb-1">Error al descifrar</p>
                  <p className="text-xs text-white/40">{decryptError}</p>
                </div>
              ) : firmaDescifrada ? (
                <>
                  {/* Firma visualizada */}
                  <div className="bg-green-500/5 border border-green-400/15 rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                      <p className="text-xs text-green-300 font-medium">
                        Firma descifrada exitosamente con AES-256-CBC
                      </p>
                    </div>
                  </div>

                  {/* Canvas de firma */}
                  <div className="rounded-xl overflow-hidden border border-white/15 bg-black/40 mb-4">
                    <img
                      src={firmaDescifrada.signatureDataUrl}
                      alt="Firma digital descifrada"
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 bg-white/5 rounded-xl border border-white/10 p-4">
                    <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                      Metadatos de la firma
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-white/30">
                          ID Empleado
                        </p>
                        <p className="text-xs text-white font-mono">
                          {firmaDescifrada.employee}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30">
                          Documento
                        </p>
                        <p className="text-xs text-white font-mono">
                          {firmaDescifrada.document}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30">
                          Fecha y hora
                        </p>
                        <p className="text-xs text-white">
                          {formatFechaHora(firmaDescifrada.timestamp)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30">
                          Token Record
                        </p>
                        <p className="text-xs text-white font-mono truncate">
                          {firmaDescifrada.tokenRecord}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 flex justify-end">
              <button
                onClick={closeFirmaModal}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white/60 text-xs font-medium hover:bg-white/15 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
