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
  MapPin,
  User,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import EvaluacionFlow from "@/components/evaluaciones/EvaluacionFlow";

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
          className="flex-[2] py-3 rounded-xl bg-[#0154AC] text-white text-sm font-semibold hover:bg-[#0143A0] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
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
// Información del evento
// ══════════════════════════════════════════════════════════
interface EventoInfo {
  titulo: string;
  fecha: string;
  lugar: string;
  ciudad: string;
  conferencista: string;
}

interface PageData {
  nombre: string;
  cedula: string;
  detalleRecordId: string;
  yaFirmo: boolean;
  idEmpleadoCore: string | null;
  progIds: string[];
  cargo?: string;
  evento: EventoInfo;
}

// ── Componente interno que usa useSearchParams ──
function FirmarContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  // Redirect to /evaluar/capacitacion — all new tokens point there already,
  // but this catches old/cached links to /firmar/capacitacion.
  useEffect(() => {
    if (token) {
      window.location.replace(`/evaluar/capacitacion?t=${encodeURIComponent(token)}`);
    }
  }, [token]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [showEval, setShowEval] = useState(false);

  const validateToken = useCallback(async () => {
    if (!token) {
      setError("No se encontró el enlace de firma. Solicita un nuevo enlace al organizador.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/registros-asistencia/firmar-publico?t=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Enlace inválido o expirado.");
      } else {
        setData(json.data);
        if (json.data.yaFirmo) {
          setFirmado(true);
          if (json.data.idEmpleadoCore) setShowEval(true);
        }
      }
    } catch {
      setError("Error al verificar el enlace. Revisa tu conexión e intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { validateToken(); }, [validateToken]);

  const handleFirma = async (firmaDataUrl: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/registros-asistencia/firmar-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firmaDataUrl }),
      });
      const json = await res.json();
      if (json.success) {
        // Update idEmpleadoCore / progIds in data if returned
        if (json.idEmpleadoCore && data) {
          setData({ ...data, idEmpleadoCore: json.idEmpleadoCore, progIds: json.progIds || [] });
        }
        setFirmado(true);
        if (json.idEmpleadoCore) setShowEval(true);
      } else {
        setError(json.message || "Error al guardar la firma.");
      }
    } catch {
      setError("Error de conexión. Vuelve a intentarlo.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFecha = (raw: string) => {
    if (!raw) return "";
    try {
      const d = new Date(raw + "T12:00:00");
      return d.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch { return raw; }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0154AC]/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#0154AC] animate-spin" />
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
            Los enlaces son válidos por 72 horas. Contacta al organizador del evento para recibir un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Ya firmó ──
  if (firmado) {
    const evalContent = showEval && data?.idEmpleadoCore ? (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <EvaluacionFlow
          idEmpleadoCore={data.idEmpleadoCore}
          nombres={data.nombre}
          cedula={data.cedula}
          cargo={data.cargo}
          progCapId={data.progIds?.[0]}
          onFinished={() => setShowEval(false)}
        />
      </div>
    ) : null;

    if (showEval && evalContent) {
      // Full-page scrollable layout with eval
      return (
        <div className="min-h-screen bg-slate-50 p-4 pb-10">
          <div className="max-w-lg mx-auto pt-6 space-y-5">
            {/* Logo */}
            <div className="flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3 flex items-center gap-3">
                <Image src="/logo.png" alt="Sirius SG-SST" width={100} height={36} className="object-contain" />
              </div>
            </div>

            {/* Compact success card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">¡Firma registrada!</p>
                  <p className="text-xs text-slate-500">{data.nombre} · C.C. {data.cedula}</p>
                </div>
              </div>
            </div>

            {/* Evaluation flow */}
            {evalContent}

            <p className="text-center text-xs text-slate-400 pb-4">
              Sirius Regenerative Solutions S.A.S. ZOMAC · SG-SST
            </p>
          </div>
        </div>
      );
    }

    // Standard centered success card (no eval or eval dismissed)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">¡Firma registrada!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-4">
            Tu asistencia al evento ha sido confirmada exitosamente.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">Asistente</p>
            <p className="text-sm font-semibold text-slate-800">{data.nombre}</p>
            <p className="text-xs text-slate-500">C.C. {data.cedula}</p>
            <p className="text-xs text-slate-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Evento</p>
            <p className="text-sm text-slate-700 leading-snug">{data.evento.titulo}</p>
            <p className="text-xs text-slate-500 mt-1">
              {formatFecha(data.evento.fecha)} · {data.evento.ciudad}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mt-5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            Firma cifrada y almacenada de forma segura
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de firma ──
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10">
      <div className="max-w-lg mx-auto pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3 flex items-center gap-3">
            <Image src="/logo.png" alt="Sirius SG-SST" width={100} height={36} className="object-contain" />
          </div>
        </div>

        {/* Card del evento */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-[#0154AC] px-5 py-4">
            <p className="text-xs text-blue-200 uppercase tracking-widest font-semibold mb-1">
              Registro de Asistencia
            </p>
            <h1 className="text-base font-bold text-white leading-snug">
              {data.evento.titulo}
            </h1>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <CalendarDays className="w-4 h-4 text-[#0154AC] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Fecha</p>
                <p className="text-sm font-medium text-slate-800">{formatFecha(data.evento.fecha)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#0154AC] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Lugar</p>
                <p className="text-sm font-medium text-slate-800">
                  {data.evento.lugar || data.evento.ciudad || "—"}
                </p>
              </div>
            </div>
            {data.evento.conferencista && (
              <div className="flex items-start gap-2 col-span-2">
                <User className="w-4 h-4 text-[#0154AC] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Conferencista</p>
                  <p className="text-sm font-medium text-slate-800">{data.evento.conferencista}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card del asistente + firma */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          {/* Asistente */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-[#0154AC]/10 flex items-center justify-center text-[#0154AC] font-bold text-base">
              {data.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{data.nombre}</p>
              <p className="text-xs text-slate-500">C.C. {data.cedula}</p>
            </div>
          </div>

          {/* Canvas */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#0154AC]" />
              Coloca tu firma aquí
            </p>
            <SignatureCanvas onConfirm={handleFirma} loading={submitting} />
          </div>

          {/* Error inline */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Seguridad */}
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
            Tu firma se cifra con AES-256 antes de almacenarse · Solo válida para este evento
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          Sirius Regenerative Solutions S.A.S. ZOMAC · SG-SST
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Página principal (wrapped en Suspense por useSearchParams)
// ══════════════════════════════════════════════════════════
export default function FirmarCapacitacionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 text-[#0154AC] animate-spin" />
      </div>
    }>
      <FirmarContent />
    </Suspense>
  );
}
