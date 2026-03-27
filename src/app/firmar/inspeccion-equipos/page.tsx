"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import {
  PenTool,
  Eraser,
  Check,
  AlertCircle,
  CheckCircle,
  Loader2,
  CalendarDays,
  User,
  ShieldCheck,
  MapPin,
  Flame,
  ClipboardCheck,
} from "lucide-react";
import Image from "next/image";
import { formatFechaColombia } from "@/shared/utils";

// ══════════════════════════════════════════════════════════
// Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  loading,
}: {
  onConfirm: (dataUrl: string) => void;
  loading: boolean;
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
    ctx.strokeStyle = "#1a1a33";
    ctx.lineWidth = 3;
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

  const handleConfirm = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={700}
          height={220}
          className="w-full h-[180px] sm:h-[200px] cursor-crosshair touch-none"
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
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Firme aquí con su dedo o cursor
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={clearCanvas}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Eraser className="w-4 h-4" /> Limpiar
        </button>
        <button
          onClick={handleConfirm}
          disabled={isEmpty || loading}
          className="flex-[2] py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-200"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
          ) : (
            <><Check className="w-4 h-4" /> Confirmar Firma</>
          )}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Tipos de datos
// ══════════════════════════════════════════════════════════
interface EquipoInspeccionado {
  codigo: string;
  nombre: string;
  categoria: string;
  estadoGeneral: string;
}

interface PageData {
  tokenValido: boolean;
  inspeccionId: string;
  cabeceraRecordId: string;
  responsableRecordId: string;
  fechaInspeccion: string;
  inspector: string;
  area: string;
  nombreResponsable: string;
  documentoMascara: string;
  cargo: string;
  estado: string;
  yaFirmado: boolean;
  equipos: EquipoInspeccionado[];
  totalEquipos: number;
  fechaExpiracion: string;
}

// ══════════════════════════════════════════════════════════
// Componente interno que usa useSearchParams
// ══════════════════════════════════════════════════════════
function FirmarInspeccionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [cedula, setCedula] = useState("");
  const [cedulaError, setCedulaError] = useState<string | null>(null);

  const validateToken = useCallback(async () => {
    if (!token) {
      setError("No se encontró el enlace de firma. Solicita un nuevo enlace al coordinador SST.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/inspecciones-equipos/token/validar?t=${encodeURIComponent(token)}`);
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Enlace inválido o expirado.");
      } else {
        setData(json.data);
        if (json.data.yaFirmado) {
          setFirmado(true);
        }
      }
    } catch {
      setError("Error al verificar el enlace. Revisa tu conexión e intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { validateToken(); }, [validateToken]);

  // Validar cédula en tiempo real
  const handleCedulaChange = (value: string) => {
    setCedula(value);
    setCedulaError(null);

    if (data && value.length >= 4) {
      const ultimos4 = value.slice(-4);
      const mascara = data.documentoMascara;
      const esperados4 = mascara.slice(-4);

      if (ultimos4 !== esperados4) {
        setCedulaError("Los últimos 4 dígitos no coinciden");
      }
    }
  };

  const handleFirma = async (firmaDataUrl: string) => {
    if (!token || !cedula) return;

    if (data) {
      const esperados4 = data.documentoMascara.slice(-4);
      const ingresados4 = cedula.slice(-4);

      if (ingresados4 !== esperados4) {
        setCedulaError("Número de documento incorrecto");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/inspecciones-equipos/firmar-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          cedula,
          signatureData: firmaDataUrl,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setFirmado(true);
      } else {
        setError(json.message || "Error al guardar la firma.");
      }
    } catch {
      setError("Error de conexión. Vuelve a intentarlo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
          </div>
          <p className="text-slate-500 text-sm">Verificando enlace…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Enlace no válido</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{error}</p>
          <p className="text-xs text-slate-400 mt-4">
            Los enlaces son válidos por 72 horas. Contacta al coordinador SST para recibir un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Ya firmó ──
  if (firmado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">¡Firma registrada!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-4">
            La inspección de equipos de emergencia ha sido confirmada exitosamente.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">Responsable</p>
            <p className="text-sm font-semibold text-slate-800">{data.nombreResponsable}</p>
            <p className="text-xs text-slate-500">C.C. {data.documentoMascara}</p>
            <p className="text-xs text-slate-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Área</p>
            <p className="text-sm text-slate-700">{data.area}</p>
            <p className="text-xs text-slate-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Fecha de Inspección</p>
            <p className="text-sm text-slate-700">{formatFechaColombia(data.fechaInspeccion, { format: "long" })}</p>
            <p className="text-xs text-slate-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Equipos</p>
            <p className="text-sm text-slate-700">{data.totalEquipos} equipos inspeccionados</p>
          </div>
          <div className="flex items-center justify-center gap-2 mt-5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            Firma cifrada con AES-256 y almacenada de forma segura
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de firma ──
  // La cédula es válida si tiene al menos 6 dígitos y los últimos 4 coinciden
  const cedulaValida = cedula.length >= 6 && !cedulaError;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10">
      <div className="max-w-lg mx-auto pt-6 space-y-5">

        {/* Header / Logo */}
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3 flex items-center gap-3">
            <Image src="/logo.png" alt="Sirius SG-SST" width={100} height={36} className="object-contain" />
          </div>
        </div>

        {/* Card info de inspección */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-red-500 px-5 py-4">
            <p className="text-xs text-red-200 uppercase tracking-widest font-semibold mb-1">
              {data.estado === "Firmado" ? "Actualización de Firma" : "Confirmación de Inspección"}
            </p>
            <h1 className="text-base font-bold text-white leading-snug">
              Inspección de Equipos de Emergencia
            </h1>
            {data.estado === "Firmado" && (
              <p className="text-xs text-red-200/80 mt-1">
                Ya existe una firma anterior. Al firmar nuevamente se actualizará.
              </p>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Info general */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Área</p>
                <p className="text-sm font-semibold text-slate-800">{data.area}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Fecha de Inspección</p>
                <p className="text-sm text-slate-700">{formatFechaColombia(data.fechaInspeccion, { format: "long" })}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Responsable del Área</p>
                <p className="text-sm font-semibold text-slate-800">{data.nombreResponsable}</p>
                <p className="text-xs text-slate-500">C.C. {data.documentoMascara} · {data.cargo}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Inspector</p>
                <p className="text-sm text-slate-700">{data.inspector}</p>
              </div>
            </div>

            {/* Resumen de equipos */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-red-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                  Equipos Inspeccionados ({data.totalEquipos})
                </p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.equipos.map((equipo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-slate-100"
                  >
                    <span className="text-xs text-slate-700">{equipo.categoria}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        equipo.estadoGeneral === "Bueno"
                          ? "bg-green-100 text-green-700"
                          : equipo.estadoGeneral === "Malo"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {equipo.estadoGeneral || "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Verificación de identidad */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-500" />
            Verificación de Identidad
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Ingresa tu número de cédula completo para confirmar tu identidad antes de firmar.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cedula}
            onChange={(e) => handleCedulaChange(e.target.value.replace(/\D/g, ""))}
            placeholder="Número de cédula"
            className={`w-full px-4 py-3 text-base rounded-xl border-2 bg-slate-50 focus:outline-none focus:bg-white transition-all ${
              cedulaError
                ? "border-red-300 focus:border-red-400"
                : cedulaValida
                ? "border-green-300 focus:border-green-400"
                : "border-slate-200 focus:border-red-400"
            }`}
          />
          {cedulaError && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {cedulaError}
            </p>
          )}
        </div>

        {/* Firma digital */}
        {cedulaValida && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-red-500" />
              Firma Digital
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Firma en el recuadro de abajo para confirmar que has verificado la inspección de equipos de emergencia del área <strong>{data.area}</strong>.
            </p>
            <SignatureCanvas onConfirm={handleFirma} loading={submitting} />
          </div>
        )}

        {/* Error mensaje */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Footer legal */}
        <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
          Al firmar, confirmo que he revisado la inspección de los equipos de emergencia en el área indicada
          y acepto los resultados registrados. Esta firma tiene validez legal según el Art. 7 Ley 527 de 1999.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Página con Suspense para useSearchParams
// ══════════════════════════════════════════════════════════
export default function FirmarInspeccionEquiposPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      }
    >
      <FirmarInspeccionContent />
    </Suspense>
  );
}
