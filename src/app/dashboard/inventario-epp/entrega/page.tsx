"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Send,
  ChevronLeft,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Package,
  Plus,
  Minus,
  X,
  UserPlus,
  Users,
  User,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  PenTool,
  Eraser,
  Check,
  Camera,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";
import { guardarEnGaleria } from "@/shared/utils";

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

interface InsumoEPP {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  stockActual: number;
  estado: string;
  imagen: { url: string; filename: string } | null;
}

interface LineaEntrega {
  insumoId: string;
  insumo: InsumoEPP;
  cantidad: number;
}

interface BeneficiarioEntrega {
  id: string;
  persona: PersonalItem;
  lineas: LineaEntrega[];
  expandido: boolean;
}

interface EntregaCreada {
  entregaId: string;
  tokenId: string;
  tokenRecordId: string;
  idEmpleado: string;
  nombreCompleto: string;
  numeroDocumento: string;
  firmado: boolean;
}

type PageState = "idle" | "submitting" | "signing" | "success" | "error";

const MOTIVOS = [
  "Dotación Inicial",
  "Reposición por Desgaste",
  "Reposición por Pérdida",
  "Reposición por Vencimiento",
  "Cambio de Cargo/Área",
  "Otro",
];

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
let _uid = 0;
function uid() {
  return `ben-${++_uid}-${Date.now()}`;
}

// ══════════════════════════════════════════════════════════
// Componente Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  isSubmitting,
}: {
  onConfirm: (dataUrl: string) => void;
  isSubmitting: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const fillWhite = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (canvasRef.current) fillWhite(canvasRef.current);
  }, []);

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
    if (!canvasRef.current) return;
    fillWhite(canvasRef.current);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const confirmSignature = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    // Exportar PNG con trazos negros sobre fondo transparente (tal cual)
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden border border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[140px] sm:h-[180px] cursor-crosshair touch-none"
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
            <p className="text-gray-300 text-sm flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Firme aquí
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={clearCanvas}
          disabled={isSubmitting}
          className="flex-1 py-2 rounded-lg bg-white/10 border border-white/15 text-white/60 text-xs font-medium hover:bg-white/15 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <Eraser className="w-3.5 h-3.5" />
          Limpiar
        </button>
        <button
          onClick={confirmSignature}
          disabled={isEmpty || isSubmitting}
          className="flex-1 py-2 rounded-lg bg-green-500/25 border border-green-400/30 text-green-300 text-xs font-semibold hover:bg-green-500/35 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Firmando...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Confirmar firma
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function EntregaEPPPage() {
  const router = useRouter();
  const { user, isLoaded } = useSession();

  // Datos maestros
  const [personal, setPersonal] = useState<PersonalItem[]>([]);
  const [catalogo, setCatalogo] = useState<InsumoEPP[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Beneficiarios
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioEntrega[]>([]);

  // Modales
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [showEppSelector, setShowEppSelector] = useState<string | null>(null);
  const [searchPersona, setSearchPersona] = useState("");
  const [searchEpp, setSearchEpp] = useState("");

  // Datos de entrega
  const [notas, setNotas] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOtro, setMotivoOtro] = useState("");

  // Fotos evidencia — Dotación (0-3)
  const [fotosDotacion, setFotosDotacion] = useState<File[]>([]);
  const [fotosPreviewsDotacion, setFotosPreviewsDotacion] = useState<string[]>([]);
  const fotoInputRefDotacion = useRef<HTMLInputElement>(null);

  // Fotos evidencia — EPP (0-3)
  const [fotosEpp, setFotosEpp] = useState<File[]>([]);
  const [fotosPreviewsEpp, setFotosPreviewsEpp] = useState<string[]>([]);
  const fotoInputRefEpp = useRef<HTMLInputElement>(null);

  const [fotoUploading, setFotoUploading] = useState(false);

  // Visibilidad de paneles de fotos
  const esDotacion = motivo.toLowerCase().includes("dotación");
  const tieneEpp = beneficiarios.some((b) => b.lineas.length > 0);

  // Estado de la página
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Entregas creadas (para fase de firmas)
  const [entregasCreadas, setEntregasCreadas] = useState<EntregaCreada[]>([]);
  const [signingIndex, setSigningIndex] = useState(0);
  const [signingSubmitting, setSigningSubmitting] = useState(false);

  // ── Stock disponible dinámico ─────────────────────────
  const stockDisponible = useMemo(() => {
    const map = new Map<string, number>();
    for (const epp of catalogo) {
      map.set(epp.id, epp.stockActual ?? 0);
    }
    for (const ben of beneficiarios) {
      for (const linea of ben.lineas) {
        const current = map.get(linea.insumoId) || 0;
        map.set(linea.insumoId, current - linea.cantidad);
      }
    }
    return map;
  }, [catalogo, beneficiarios]);

  // ── Cargar datos ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [resPersonal, resEpp] = await Promise.all([
        fetch("/api/personal"),
        fetch("/api/insumos/epp"),
      ]);
      const [jsonPersonal, jsonEpp] = await Promise.all([
        resPersonal.json(),
        resEpp.json(),
      ]);
      if (jsonPersonal.success) setPersonal(jsonPersonal.data);
      if (jsonEpp.success) setCatalogo(jsonEpp.data);
    } catch {
      /* silent */
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Gestión beneficiarios ─────────────────────────────
  const agregarBeneficiario = (persona: PersonalItem) => {
    setBeneficiarios((prev) => [
      ...prev,
      { id: uid(), persona, lineas: [], expandido: true },
    ]);
    setShowPersonaSelector(false);
    setSearchPersona("");
  };

  const eliminarBeneficiario = (benId: string) => {
    setBeneficiarios((prev) => prev.filter((b) => b.id !== benId));
  };

  const toggleExpandir = (benId: string) => {
    setBeneficiarios((prev) =>
      prev.map((b) => (b.id === benId ? { ...b, expandido: !b.expandido } : b))
    );
  };

  const agregarEpp = (benId: string, insumo: InsumoEPP) => {
    setBeneficiarios((prev) =>
      prev.map((b) =>
        b.id === benId
          ? {
              ...b,
              lineas: [
                ...b.lineas,
                { insumoId: insumo.id, insumo, cantidad: 1 },
              ],
            }
          : b
      )
    );
    setShowEppSelector(null);
    setSearchEpp("");
  };

  const actualizarCantidad = (benId: string, insumoId: string, delta: number) => {
    setBeneficiarios((prev) =>
      prev.map((b) => {
        if (b.id !== benId) return b;
        return {
          ...b,
          lineas: b.lineas.map((l) => {
            if (l.insumoId !== insumoId) return l;
            const nuevo = l.cantidad + delta;
            if (nuevo < 1) return l;
            const disponible = (stockDisponible.get(insumoId) || 0) + l.cantidad;
            if (nuevo > disponible) return l;
            return { ...l, cantidad: nuevo };
          }),
        };
      })
    );
  };

  const setCantidadDirecta = (benId: string, insumoId: string, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    setBeneficiarios((prev) =>
      prev.map((b) => {
        if (b.id !== benId) return b;
        return {
          ...b,
          lineas: b.lineas.map((l) => {
            if (l.insumoId !== insumoId) return l;
            const disponible = (stockDisponible.get(insumoId) || 0) + l.cantidad;
            return { ...l, cantidad: Math.max(1, Math.min(n, disponible)) };
          }),
        };
      })
    );
  };

  const eliminarEpp = (benId: string, insumoId: string) => {
    setBeneficiarios((prev) =>
      prev.map((b) =>
        b.id === benId
          ? { ...b, lineas: b.lineas.filter((l) => l.insumoId !== insumoId) }
          : b
      )
    );
  };

  // ── Totales ───────────────────────────────────────────
  const totalLineas = beneficiarios.reduce((a, b) => a + b.lineas.length, 0);
  const totalUnidades = beneficiarios.reduce(
    (a, b) => a + b.lineas.reduce((x, l) => x + l.cantidad, 0),
    0
  );
  const personasAgregadasIds = new Set(beneficiarios.map((b) => b.persona.id));

  // ══════════════════════════════════════════════════════
  // SUBMIT: Crear entregas en Airtable
  // ══════════════════════════════════════════════════════
  const handleSubmit = async () => {
    if (beneficiarios.length === 0) return;
    if (beneficiarios.some((b) => b.lineas.length === 0)) {
      setErrorMsg("Todos los beneficiarios deben tener al menos un EPP asignado.");
      setPageState("error");
      return;
    }
    setPageState("submitting");
    setErrorMsg("");

    try {
      // Fecha en timezone Colombia (YYYY-MM-DD)
      const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

      const payload = {
        beneficiarios: beneficiarios.map((ben) => ({
          idEmpleado: ben.persona.idEmpleado,
          nombreCompleto: ben.persona.nombreCompleto,
          numeroDocumento: ben.persona.numeroDocumento,
          lineas: ben.lineas.map((l) => ({
            insumoId: l.insumoId,
            codigoInsumo: l.insumo.codigo,
            nombre: l.insumo.nombre,
            cantidad: l.cantidad,
            talla: "Única",
            condicion: "Nuevo",
          })),
        })),
        responsable: "Coordinador SST",
        responsableId: user?.idEmpleado || "",
        observaciones: notas,
        motivo: motivo === "Otro" ? (motivoOtro.trim() || "Otro") : motivo,
        fechaEntrega: fechaHoy,
      };

      const res = await fetch("/api/entregas-epp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.message || "Error al crear entregas");
      }

      // Transicionar a fase de firmas
      const entregas: EntregaCreada[] = json.entregas.map(
        (e: EntregaCreada) => ({ ...e, firmado: false })
      );

      // Subir fotos de evidencia a S3 (dotación + EPP combinadas)
      const todasLasFotos = [...fotosDotacion, ...fotosEpp];
      if (todasLasFotos.length > 0 && entregas.length > 0) {
        setFotoUploading(true);
        try {
          for (const ent of entregas) {
            // Paso 1: Obtener URLs prefirmadas de carga
            const presignRes = await fetch("/api/entregas-epp/foto-evidencia/presign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entregaRecordId: ent.entregaId,
                fotos: todasLasFotos.map((f) => ({
                  type: f.type,
                  extension: f.name.split(".").pop() || "jpg",
                })),
              }),
            });
            const presignJson = await presignRes.json();
            if (!presignJson.success) {
              console.error("Error obteniendo URLs de carga:", presignJson.message);
              continue;
            }

            // Paso 2: Subir cada foto directo a S3 con la URL prefirmada
            const s3Keys: string[] = [];
            for (let i = 0; i < todasLasFotos.length; i++) {
              const foto = todasLasFotos[i];
              const upload = presignJson.uploads[i];
              const putRes = await fetch(upload.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": upload.contentType },
                body: foto,
              });
              if (putRes.ok) {
                s3Keys.push(upload.key);
              } else {
                console.error(`Error subiendo foto ${i + 1} a S3:`, putRes.status);
              }
            }

            // Paso 3: Notificar al backend para guardar URLs en Airtable
            if (s3Keys.length > 0) {
              const saveRes = await fetch("/api/entregas-epp/foto-evidencia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  entregaRecordId: ent.entregaId,
                  s3Keys,
                }),
              });
              const saveJson = await saveRes.json();
              if (!saveJson.success) {
                console.error("Error guardando fotos en Airtable:", saveJson.message);
              }
            }
          }
        } catch (fotoErr) {
          console.error("Error subiendo fotos de evidencia:", fotoErr);
        } finally {
          setFotoUploading(false);
        }
      }

      setEntregasCreadas(entregas);
      setSigningIndex(0);
      setPageState("signing");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setPageState("error");
    }
  };

  // ══════════════════════════════════════════════════════
  // FIRMA: Enviar firma encriptada con AES (server-side)
  // ══════════════════════════════════════════════════════
  const handleSign = async (dataUrl: string) => {
    const entrega = entregasCreadas[signingIndex];
    if (!entrega) return;

    setSigningSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/entregas-epp/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenRecordId: entrega.tokenRecordId,
          entregaId: entrega.entregaId,
          signatureData: dataUrl,
          idEmpleado: entrega.idEmpleado,
          numeroDocumento: entrega.numeroDocumento,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      // Marcar como firmado
      const updated = entregasCreadas.map((e, i) =>
        i === signingIndex ? { ...e, firmado: true } : e
      );
      setEntregasCreadas(updated);

      // Buscar siguiente pendiente
      const nextPending = updated.findIndex(
        (e, i) => i > signingIndex && !e.firmado
      );

      if (nextPending !== -1) {
        setSigningIndex(nextPending);
      } else {
        setPageState("success");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al registrar firma");
    } finally {
      setSigningSubmitting(false);
    }
  };

  const skipSignature = () => {
    const nextPending = entregasCreadas.findIndex(
      (e, i) => i > signingIndex && !e.firmado
    );
    if (nextPending !== -1) {
      setSigningIndex(nextPending);
    } else {
      setPageState("success");
    }
  };

  // ── Reset ─────────────────────────────────────────────
  const resetForm = () => {
    setPageState("idle");
    setErrorMsg("");
    setBeneficiarios([]);
    setNotas("");
    setMotivo(MOTIVOS[0]);
    setMotivoOtro("");
    setFotosDotacion([]);
    setFotosPreviewsDotacion([]);
    setFotosEpp([]);
    setFotosPreviewsEpp([]);
    setEntregasCreadas([]);
    setSigningIndex(0);
    fetchData();
  };

  // ── Filtros ───────────────────────────────────────────
  const filteredPersonal = personal.filter(
    (p) =>
      !personasAgregadasIds.has(p.id) &&
      (p.nombreCompleto.toLowerCase().includes(searchPersona.toLowerCase()) ||
        p.numeroDocumento.includes(searchPersona) ||
        p.idEmpleado.toLowerCase().includes(searchPersona.toLowerCase()))
  );

  const getFilteredEpps = (benId: string) => {
    const ben = beneficiarios.find((b) => b.id === benId);
    const lineasIds = new Set(ben?.lineas.map((l) => l.insumoId) || []);
    return catalogo.filter(
      (e) =>
        !lineasIds.has(e.id) &&
        (stockDisponible.get(e.id) || 0) > 0 &&
        (e.nombre.toLowerCase().includes(searchEpp.toLowerCase()) ||
          e.codigo.toLowerCase().includes(searchEpp.toLowerCase()))
    );
  };

  // Firma: datos actuales
  const currentSigning = entregasCreadas[signingIndex];
  const firmasCompletadas = entregasCreadas.filter((e) => e.firmado).length;

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  {pageState === "signing" ? (
                    <PenTool className="w-5 h-5 text-orange-400" />
                  ) : (
                    <Send className="w-5 h-5 text-orange-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    {pageState === "signing"
                      ? "Firma de Entrega"
                      : "Entrega de EPP"}
                  </h1>
                  <p className="text-xs text-white/50">
                    {pageState === "signing"
                      ? `Firma ${firmasCompletadas + 1} de ${entregasCreadas.length}`
                      : "Registrar entrega a empleados"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══ CARGANDO ═══ */}
        {loadingData && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        )}

        {/* ═══ ÉXITO FINAL ═══ */}
        {pageState === "success" && (
          <div className="bg-green-500/10 backdrop-blur-xl border border-green-400/20 rounded-2xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              ¡Entrega completada!
            </h2>
            <p className="text-white/60 mb-2">
              Se registraron {entregasCreadas.length} entrega(s) en Airtable.
            </p>
            <p className="text-white/40 text-sm mb-6">
              {firmasCompletadas} de {entregasCreadas.length} firma(s) confirmada(s)
              {firmasCompletadas < entregasCreadas.length && (
                <span className="text-amber-400">
                  {" "}
                  · {entregasCreadas.length - firmasCompletadas} pendiente(s)
                </span>
              )}
            </p>

            {/* Resumen */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6 text-left">
              {entregasCreadas.map((e) => (
                <div
                  key={e.entregaId}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      e.firmado
                        ? "bg-green-500/20 text-green-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {e.firmado ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {e.nombreCompleto}
                    </p>
                    <p className="text-[10px] text-white/30 font-mono">
                      {e.idEmpleado}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      e.firmado ? "text-green-400" : "text-amber-400"
                    }`}
                  >
                    {e.firmado ? "Firmado" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl bg-orange-500/20 border border-orange-400/30 text-orange-300 text-sm font-semibold hover:bg-orange-500/30 transition-all cursor-pointer"
              >
                Nueva entrega
              </button>
              <button
                onClick={() => router.push("/dashboard/inventario-epp")}
                className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/20 transition-all cursor-pointer"
              >
                Volver al inventario
              </button>
            </div>
          </div>
        )}

        {/* ═══ ERROR ═══ */}
        {pageState === "error" && (
          <div className="bg-red-500/10 backdrop-blur-xl border border-red-400/20 rounded-2xl p-8 text-center mb-6">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">
              Error al registrar
            </h2>
            <p className="text-red-300 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition-all cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
             FASE DE FIRMAS
             ═══════════════════════════════════════════════ */}
        {pageState === "signing" && currentSigning && (
          <div className="space-y-6">
            {/* Barra de progreso */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-white/50">Progreso de firmas</p>
                <p className="text-xs font-semibold text-orange-300">
                  {firmasCompletadas}/{entregasCreadas.length}
                </p>
              </div>
              <div className="flex gap-1.5">
                {entregasCreadas.map((e, i) => (
                  <div
                    key={e.entregaId}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      e.firmado
                        ? "bg-green-400/60"
                        : i === signingIndex
                        ? "bg-orange-400/60 animate-pulse"
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Tarjeta del firmante actual */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 border-2 border-orange-400/40 flex items-center justify-center">
                  <User className="w-7 h-7 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white">
                    {currentSigning.nombreCompleto}
                  </p>
                  <p className="text-xs text-white/40 font-mono">
                    {currentSigning.idEmpleado} · CC{" "}
                    {currentSigning.numeroDocumento}
                  </p>
                </div>
              </div>

              <div className="bg-orange-500/5 border border-orange-400/15 rounded-xl p-3 mb-5">
                <p className="text-xs text-orange-300/70 mb-1 font-medium">
                  Instrucciones
                </p>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  El empleado{" "}
                  <strong className="text-white/80">
                    {currentSigning.nombreCompleto.split(" ")[0]}
                  </strong>{" "}
                  debe firmar en el recuadro inferior para confirmar la recepción
                  de los EPPs entregados. La firma será encriptada con AES-256
                  para su protección.
                </p>
              </div>

              {/* Canvas de firma */}
              <SignatureCanvas
                onConfirm={handleSign}
                isSubmitting={signingSubmitting}
              />

              {/* Error de firma inline */}
              {errorMsg && (
                <div className="mt-3 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-300">{errorMsg}</p>
                </div>
              )}

              {/* Omitir firma */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <button
                  onClick={skipSignature}
                  disabled={signingSubmitting}
                  className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-all cursor-pointer disabled:opacity-30"
                >
                  Omitir firma de este empleado →
                </button>
              </div>
            </div>

            {/* Lista de todos los firmantes */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-4">
              <p className="text-xs text-white/40 mb-3 font-medium">
                Todos los beneficiarios
              </p>
              <div className="space-y-1.5">
                {entregasCreadas.map((e, i) => (
                  <div
                    key={e.entregaId}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                      i === signingIndex
                        ? "bg-orange-500/10 border border-orange-400/20"
                        : "bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        e.firmado
                          ? "bg-green-500/20 text-green-400"
                          : i === signingIndex
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-white/10 text-white/30"
                      }`}
                    >
                      {e.firmado ? (
                        <Check className="w-3 h-3" />
                      ) : i === signingIndex ? (
                        <PenTool className="w-3 h-3" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <p
                      className={`text-xs flex-1 truncate ${
                        i === signingIndex
                          ? "text-white font-medium"
                          : "text-white/50"
                      }`}
                    >
                      {e.nombreCompleto}
                    </p>
                    <span
                      className={`text-[10px] ${
                        e.firmado
                          ? "text-green-400"
                          : i === signingIndex
                          ? "text-orange-400"
                          : "text-white/20"
                      }`}
                    >
                      {e.firmado
                        ? "✓"
                        : i === signingIndex
                        ? "Firmando..."
                        : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
             FORMULARIO DE ENTREGA
             ═══════════════════════════════════════════════ */}
        {!loadingData && (pageState === "idle" || pageState === "submitting") && (
          <>
            {/* Alerta de sesión */}
            {!user && isLoaded && (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-300">
                    Sesión no detectada
                  </p>
                  <p className="text-xs text-white/50">
                    Inicia sesión para registrar entregas.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/login")}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            )}

            {/* ── Beneficiarios ──────────────────────── */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  Beneficiarios
                  {beneficiarios.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs">
                      {beneficiarios.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowPersonaSelector(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-300 text-sm font-medium hover:bg-orange-500/30 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar persona
                </button>
              </div>

              {beneficiarios.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-xl">
                  <Users className="w-10 h-10 text-white/15 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">
                    Selecciona los empleados a quienes se les entregará EPP
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {beneficiarios.map((ben) => (
                    <div
                      key={ben.id}
                      className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                    >
                      {/* Cabecera */}
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center overflow-hidden shrink-0">
                          {ben.persona.fotoPerfil ? (
                            <img
                              src={ben.persona.fotoPerfil.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-orange-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {ben.persona.nombreCompleto}
                          </p>
                          <p className="text-[11px] text-white/40 font-mono">
                            {ben.persona.idEmpleado} · CC{" "}
                            {ben.persona.numeroDocumento}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs">
                          {ben.lineas.length} EPP
                          {ben.lineas.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          onClick={() => toggleExpandir(ben.id)}
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition-all cursor-pointer"
                        >
                          {ben.expandido ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => eliminarBeneficiario(ben.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Expandible: EPPs */}
                      {ben.expandido && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-white/10 pt-3">
                            {ben.lineas.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {ben.lineas.map((linea) => {
                                  const disponibleTotal =
                                    (stockDisponible.get(linea.insumoId) || 0) +
                                    linea.cantidad;
                                  return (
                                    <div
                                      key={linea.insumoId}
                                      className="flex items-center gap-3 bg-white/5 rounded-lg border border-white/5 p-3"
                                    >
                                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                        {linea.insumo.imagen ? (
                                          <img
                                            src={linea.insumo.imagen.url}
                                            alt=""
                                            className="w-full h-full object-contain p-0.5"
                                          />
                                        ) : (
                                          <Package className="w-4 h-4 text-white/20" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">
                                          {linea.insumo.nombre}
                                        </p>
                                        <p className="text-[10px] text-white/30">
                                          Stock disp.:{" "}
                                          {disponibleTotal}{" "}
                                          {linea.insumo.unidadMedida}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() =>
                                            actualizarCantidad(
                                              ben.id,
                                              linea.insumoId,
                                              -1
                                            )
                                          }
                                          className="w-7 h-7 rounded-md bg-white/10 border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/20 transition-all cursor-pointer"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <input
                                          type="number"
                                          min={1}
                                          max={disponibleTotal}
                                          value={linea.cantidad}
                                          onChange={(e) =>
                                            setCantidadDirecta(
                                              ben.id,
                                              linea.insumoId,
                                              e.target.value
                                            )
                                          }
                                          className="w-14 text-center py-1 rounded-md bg-white/10 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-orange-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                          onClick={() =>
                                            actualizarCantidad(
                                              ben.id,
                                              linea.insumoId,
                                              1
                                            )
                                          }
                                          disabled={
                                            linea.cantidad >= disponibleTotal
                                          }
                                          className="w-7 h-7 rounded-md bg-white/10 border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <span className="text-[10px] text-white/30 w-10 text-right shrink-0">
                                        {linea.insumo.unidadMedida}
                                      </span>
                                      <button
                                        onClick={() =>
                                          eliminarEpp(ben.id, linea.insumoId)
                                        }
                                        className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setShowEppSelector(ben.id);
                                setSearchEpp("");
                              }}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/15 text-white/40 text-xs hover:bg-white/5 hover:text-white/60 hover:border-white/25 transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Agregar EPP a{" "}
                              {ben.persona.nombreCompleto.split(" ")[0]}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Datos de la Entrega ────────────────── */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
              <h2 className="text-base font-semibold text-white mb-4">
                Datos de la entrega
              </h2>

              {user ? (
                <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-orange-300/60">
                      Responsable de la entrega
                    </p>
                    <p className="text-sm font-semibold text-white truncate">
                      {user.nombreCompleto}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-orange-300/50">
                    {user.idEmpleado}
                  </span>
                </div>
              ) : null}

              {/* Motivo */}
              <div className="mb-4">
                <label className="block text-xs text-white/50 mb-1.5">
                  Motivo de entrega
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-all cursor-pointer appearance-none"
                >
                  {MOTIVOS.map((m) => (
                    <option
                      key={m}
                      value={m}
                      className="bg-gray-900 text-white"
                    >
                      {m}
                    </option>
                  ))}
                </select>
                {motivo === "Otro" && (
                  <input
                    type="text"
                    placeholder="Escriba el motivo de entrega…"
                    value={motivoOtro}
                    onChange={(e) => setMotivoOtro(e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-400/50 transition-all"
                  />
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales, orden de trabajo, etc."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-orange-400/50 transition-all resize-none"
                />
              </div>
            </div>

            {/* ── Fotos de evidencia — Dotación (0-3) ──────── */}
            {esDotacion && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  Fotos de evidencia — Dotación
                  <span className="text-xs font-normal text-blue-300">({fotosDotacion.length}/3)</span>
                </h2>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  {fotosPreviewsDotacion.map((preview, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-white/15 aspect-square">
                      <img
                        src={preview}
                        alt={`Dotación ${idx + 1}`}
                        className="w-full h-full object-cover bg-black/30"
                      />
                      <button
                        onClick={() => {
                          setFotosDotacion((prev) => prev.filter((_, i) => i !== idx));
                          setFotosPreviewsDotacion((prev) => {
                            URL.revokeObjectURL(prev[idx]);
                            return prev.filter((_, i) => i !== idx);
                          });
                        }}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-600 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/70">
                        {((fotosDotacion[idx]?.size || 0) / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  ))}

                  {fotosDotacion.length < 3 && (
                    <div
                      onClick={() => fotoInputRefDotacion.current?.click()}
                      className="border-2 border-dashed border-white/15 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-blue-400/30 hover:bg-white/5 transition-all"
                    >
                      <ImageIcon className="w-8 h-8 text-white/15 mb-1.5" />
                      <p className="text-[11px] text-white/30">
                        {fotosDotacion.length === 0 ? "Agregar foto" : "Agregar otra"}
                      </p>
                    </div>
                  )}
                </div>

                {fotosDotacion.length === 0 && (
                  <p className="text-[11px] text-blue-300/60 text-center">
                    0 a 3 fotos · JPG, PNG o WebP · Máx. 10 MB c/u
                  </p>
                )}

                <input
                  ref={fotoInputRefDotacion}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      setErrorMsg("La imagen excede 10 MB");
                      return;
                    }
                    if (fotosDotacion.length >= 3) {
                      setErrorMsg("Máximo 3 fotos de dotación");
                      return;
                    }
                    guardarEnGaleria(file);
                    setFotosDotacion((prev) => [...prev, file]);
                    setFotosPreviewsDotacion((prev) => [...prev, URL.createObjectURL(file)]);
                    if (fotoInputRefDotacion.current) fotoInputRefDotacion.current.value = "";
                  }}
                />
              </div>
            )}

            {/* ── Fotos de evidencia — EPP (0-3) ─────────────── */}
            {tieneEpp && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-orange-400" />
                  Fotos de evidencia — EPP
                  <span className="text-xs font-normal text-orange-300">({fotosEpp.length}/3)</span>
                </h2>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  {fotosPreviewsEpp.map((preview, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-white/15 aspect-square">
                      <img
                        src={preview}
                        alt={`EPP ${idx + 1}`}
                        className="w-full h-full object-cover bg-black/30"
                      />
                      <button
                        onClick={() => {
                          setFotosEpp((prev) => prev.filter((_, i) => i !== idx));
                          setFotosPreviewsEpp((prev) => {
                            URL.revokeObjectURL(prev[idx]);
                            return prev.filter((_, i) => i !== idx);
                          });
                        }}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-600 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-white/70">
                        {((fotosEpp[idx]?.size || 0) / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  ))}

                  {fotosEpp.length < 3 && (
                    <div
                      onClick={() => fotoInputRefEpp.current?.click()}
                      className="border-2 border-dashed border-white/15 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-orange-400/30 hover:bg-white/5 transition-all"
                    >
                      <ImageIcon className="w-8 h-8 text-white/15 mb-1.5" />
                      <p className="text-[11px] text-white/30">
                        {fotosEpp.length === 0 ? "Agregar foto" : "Agregar otra"}
                      </p>
                    </div>
                  )}
                </div>

                {fotosEpp.length === 0 && (
                  <p className="text-[11px] text-orange-300/60 text-center">
                    0 a 3 fotos · JPG, PNG o WebP · Máx. 10 MB c/u
                  </p>
                )}

                <input
                  ref={fotoInputRefEpp}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      setErrorMsg("La imagen excede 10 MB");
                      return;
                    }
                    if (fotosEpp.length >= 3) {
                      setErrorMsg("Máximo 3 fotos de EPP");
                      return;
                    }
                    guardarEnGaleria(file);
                    setFotosEpp((prev) => [...prev, file]);
                    setFotosPreviewsEpp((prev) => [...prev, URL.createObjectURL(file)]);
                    if (fotoInputRefEpp.current) fotoInputRefEpp.current.value = "";
                  }}
                />
              </div>
            )}

            {/* ── Info sobre firma digital ────────────── */}
            <div className="bg-blue-500/5 border border-blue-400/15 rounded-xl px-4 py-3 mb-6">
              <div className="flex items-start gap-2.5">
                <PenTool className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-300">
                    Firma digital requerida
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Después de registrar la entrega, cada beneficiario deberá
                    firmar en pantalla para confirmar la recepción. Las firmas se
                    encriptan con AES-256.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Resumen y Submit ────────────────────── */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-white/50">Beneficiarios</p>
                  <p className="text-2xl font-bold text-white">
                    {beneficiarios.length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-white/50">EPPs distintos</p>
                  <p className="text-2xl font-bold text-white">{totalLineas}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/50">Unidades totales</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {totalUnidades}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={
                  beneficiarios.length === 0 ||
                  totalLineas === 0 ||
                  pageState === "submitting" ||
                  fotoUploading ||
                  !user
                }
                className="w-full py-3.5 rounded-xl bg-orange-500/30 border border-orange-400/40 text-orange-300 font-semibold text-sm hover:bg-orange-500/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {pageState === "submitting" || fotoUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {fotoUploading ? "Subiendo fotos..." : "Registrando entrega..."}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Registrar y pasar a firmas
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>

      {/* ═══ MODAL: SELECTOR DE PERSONA ═══ */}
      {showPersonaSelector && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPersonaSelector(false)}
        >
          <div
            className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl max-w-lg w-full max-h-[60vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por nombre, cédula o código..."
                  value={searchPersona}
                  onChange={(e) => setSearchPersona(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-400/50 transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPersonal.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-white/40 text-sm">
                    {searchPersona
                      ? "Sin resultados"
                      : "Todo el personal ya fue agregado"}
                  </p>
                </div>
              ) : (
                filteredPersonal.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => agregarBeneficiario(persona)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-500/15 border border-orange-400/20 flex items-center justify-center overflow-hidden shrink-0">
                      {persona.fotoPerfil ? (
                        <img
                          src={persona.fotoPerfil.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-orange-400/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {persona.nombreCompleto}
                      </p>
                      <p className="text-[11px] text-white/40 font-mono">
                        {persona.idEmpleado} · CC {persona.numeroDocumento}
                      </p>
                    </div>
                    <span className="text-[11px] text-white/30 shrink-0">
                      {persona.tipoPersonal}
                    </span>
                    <Plus className="w-4 h-4 text-orange-400/60" />
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => setShowPersonaSelector(false)}
                className="w-full py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: SELECTOR DE EPP ═══ */}
      {showEppSelector && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEppSelector(null)}
        >
          <div
            className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl max-w-lg w-full max-h-[60vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <p className="text-xs text-orange-300/60 mb-2">
                Solo EPPs con stock disponible
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar EPP por nombre o código..."
                  value={searchEpp}
                  onChange={(e) => setSearchEpp(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-400/50 transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {(() => {
                const epps = getFilteredEpps(showEppSelector);
                if (epps.length === 0)
                  return (
                    <div className="text-center py-10">
                      <p className="text-white/40 text-sm">
                        {searchEpp
                          ? "Sin resultados"
                          : "No hay EPPs con stock disponible"}
                      </p>
                    </div>
                  );
                return epps.map((insumo) => (
                  <button
                    key={insumo.id}
                    onClick={() => agregarEpp(showEppSelector, insumo)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                      {insumo.imagen ? (
                        <img
                          src={insumo.imagen.url}
                          alt=""
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {insumo.nombre}
                      </p>
                      <p className="text-[11px] text-white/40 font-mono">
                        {insumo.codigo}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-teal-400">
                        {stockDisponible.get(insumo.id) || 0}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {insumo.unidadMedida}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-orange-400/60" />
                  </button>
                ));
              })()}
            </div>
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => setShowEppSelector(null)}
                className="w-full py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all cursor-pointer"
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
