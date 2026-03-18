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
  Package,
} from "lucide-react";
import Image from "next/image";
import { formatFechaColombia } from "@/shared/utils";

// ══════════════════════════════════════════════════════════
// Canvas de Firma (Reutilizado del patrón capacitación)
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
// Tipos de datos
// ══════════════════════════════════════════════════════════
interface DetalleEntrega {
  nombreInsumo: string;
  cantidad: number;
  talla: string;
}

interface PageData {
  tokenValido: boolean;
  entregaId: string;
  tokenRecordId: string;
  fechaEntrega: string;
  nombreEmpleado: string;
  documentoMascara: string;
  idEmpleadoCore: string;
  estado: string;
  yaFirmado: boolean;
  detalles: DetalleEntrega[];
  fechaExpiracion: string;
}

// ══════════════════════════════════════════════════════════
// Componente interno que usa useSearchParams
// ══════════════════════════════════════════════════════════
function FirmarEppContent() {
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
      const res = await fetch(`/api/entregas-epp/token/validar?t=${encodeURIComponent(token)}`);
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

    // Validar contra últimos 4 dígitos si data está disponible
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

    // Validación final de cédula completa
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
      const res = await fetch("/api/entregas-epp/firmar-publico", {
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
            Los enlaces son válidos por 48 horas. Contacta al coordinador SST para recibir un nuevo enlace.
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
            Tu recepción de EPPs ha sido confirmada exitosamente.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">Beneficiario</p>
            <p className="text-sm font-semibold text-slate-800">{data.nombreEmpleado}</p>
            <p className="text-xs text-slate-500">C.C. {data.documentoMascara}</p>
            <p className="text-xs text-slate-400 mt-3 mb-1 uppercase tracking-wide font-semibold">Fecha de Entrega</p>
            <p className="text-sm text-slate-700">{formatFechaColombia(data.fechaEntrega, { format: "long" })}</p>
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
  const cedulaValida = cedula.length > 0 && !cedulaError;

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10">
      <div className="max-w-lg mx-auto pt-6 space-y-5">

        {/* Header / Logo */}
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3 flex items-center gap-3">
            <Image src="/logo.png" alt="Sirius SG-SST" width={100} height={36} className="object-contain" />
          </div>
        </div>

        {/* Card info de entrega */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-[#0154AC] px-5 py-4">
            <p className="text-xs text-blue-200 uppercase tracking-widest font-semibold mb-1">
              {data.estado === "Confirmada" ? "Actualización de Firma" : "Confirmación de Entrega"}
            </p>
            <h1 className="text-base font-bold text-white leading-snug">
              Entrega de Elementos de Protección Personal
            </h1>
            {data.estado === "Confirmada" && (
              <p className="text-xs text-blue-200/80 mt-1">
                Ya existe una firma anterior. Al firmar nuevamente se actualizará.
              </p>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#0154AC] shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Beneficiario</p>
                <p className="text-sm font-medium text-slate-800">{data.nombreEmpleado}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#0154AC] shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Fecha de Entrega</p>
                <p className="text-sm font-medium text-slate-800">
                  {formatFechaColombia(data.fechaEntrega, { format: "long" })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card EPPs entregados */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0154AC]" />
            EPPs Entregados
          </p>
          {data.detalles.length > 0 ? (
            <ul className="space-y-2">
              {data.detalles.map((det, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0154AC] mt-1.5 shrink-0" />
                  <span className="text-sm text-slate-700 leading-snug">
                    <span className="font-medium">{det.nombreInsumo}</span>
                    {" × "}
                    <span className="font-semibold text-[#0154AC]">{det.cantidad}</span>
                    {det.talla !== "Única" && (
                      <span className="text-slate-500"> (Talla {det.talla})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">No hay detalles disponibles</p>
          )}
        </div>

        {/* Card validación de cédula */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Para confirmar, ingresa tu número de cédula:
          </p>
          <input
            type="text"
            placeholder="Número de documento"
            value={cedula}
            onChange={(e) => handleCedulaChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-slate-900 text-sm focus:outline-none focus:ring-2 transition-all ${
              cedulaError
                ? "border-red-300 focus:ring-red-200"
                : "border-slate-200 focus:ring-[#0154AC]/20"
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">
              Últimos 4 dígitos: <span className="font-mono font-semibold">****{data.documentoMascara.slice(-4)}</span>
            </p>
            {cedulaError && (
              <p className="text-xs text-red-500 font-medium">{cedulaError}</p>
            )}
          </div>
        </div>

        {/* Canvas de firma */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-[#0154AC]" />
            Coloca tu firma aquí
          </p>
          <SignatureCanvas onConfirm={handleFirma} loading={submitting || !cedulaValida} />

          {!cedulaValida && cedula.length > 0 && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Debes ingresar tu cédula correcta antes de firmar
            </p>
          )}
        </div>

        {/* Error inline */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Seguridad */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
          Firma cifrada con AES-256 · Válida solo para esta entrega
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
export default function FirmarEppPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 text-[#0154AC] animate-spin" />
      </div>
    }>
      <FirmarEppContent />
    </Suspense>
  );
}
