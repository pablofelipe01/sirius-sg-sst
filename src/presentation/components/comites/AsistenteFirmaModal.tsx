"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, PenTool, Loader2 } from "lucide-react";

interface AsistenteFirmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  miembroNombre: string;
  miembroCedula: string;
  miembroCargo: string;
  miembroRecordId: string;
  onFirmaGuardada: () => void;
  comite: "copasst" | "cocolab";
  actaId?: string; // Opcional - si no existe, modo offline
  onFirmaCapturada?: (recordId: string, firmaDataUrl: string) => void; // Modo offline
}

export default function AsistenteFirmaModal({
  isOpen,
  onClose,
  miembroNombre,
  miembroCedula,
  miembroCargo,
  miembroRecordId,
  onFirmaGuardada,
  comite,
  actaId,
  onFirmaCapturada,
}: AsistenteFirmaModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let drawing = false;
    const getPos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const scaleX = c.width / r.width;
      const scaleY = c.height / r.height;
      return {
        x: (e.clientX - r.left) * scaleX,
        y: (e.clientY - r.top) * scaleY,
      };
    };
    const start = (e: PointerEvent) => {
      drawing = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineCap = "round";
      ctx.stroke();
    };
    const end = () => { drawing = false; };
    c.onpointerdown = start;
    c.onpointermove = move;
    c.onpointerup = end;
    c.onpointerleave = end;
    return () => {
      c.onpointerdown = null;
      c.onpointermove = null;
      c.onpointerup = null;
      c.onpointerleave = null;
    };
  }, [isOpen]);

  const limpiarCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const guardarFirma = async () => {
    if (!canvasRef.current) return;

    // Validar que haya dibujado algo
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    const data = imageData.data;
    let hasDrawing = false;

    // Verificar si hay al menos un píxel no blanco
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 250 || g < 250 || b < 250) {
        hasDrawing = true;
        break;
      }
    }

    if (!hasDrawing) {
      setError("Por favor firme en el recuadro antes de guardar");
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const firmaDataUrl = canvasRef.current.toDataURL("image/png");

      // Modo offline: capturar firma sin guardar en API
      if (!actaId && onFirmaCapturada) {
        onFirmaCapturada(miembroRecordId, firmaDataUrl);
        onFirmaGuardada();
        onClose();
        return;
      }

      // Modo online: guardar en API
      if (!actaId) {
        throw new Error("No se puede guardar firma sin ID de acta");
      }

      const res = await fetch(`/api/${comite}/actas/${actaId}/firmar-asistente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miembroRecordId,
          firma: firmaDataUrl,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Error al guardar firma");
      }

      onFirmaGuardada();
      onClose();
    } catch (err) {
      console.error("Error guardando firma:", err);
      setError(err instanceof Error ? err.message : "Error al guardar firma");
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-white/10 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Firmar Asistencia</h3>
            <p className="text-sm text-white/60 mt-0.5">
              {miembroNombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            disabled={guardando}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Información del miembro */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-white/60">Nombre:</span>
                <p className="text-white font-medium">{miembroNombre}</p>
              </div>
              <div>
                <span className="text-white/60">Cédula:</span>
                <p className="text-white font-medium">{miembroCedula}</p>
              </div>
              <div className="col-span-2">
                <span className="text-white/60">Cargo:</span>
                <p className="text-white font-medium">{miembroCargo}</p>
              </div>
            </div>
          </div>

          {/* Canvas de firma */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="bg-white rounded-lg">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full touch-none cursor-crosshair"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={limpiarCanvas}
                disabled={guardando}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eraser className="w-4 h-4" /> Limpiar
              </button>
              <span className="flex-1 inline-flex items-center justify-center gap-2 text-sm text-white/50">
                <PenTool className="w-4 h-4" /> Firme aquí
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-lg text-white/80 hover:text-white border border-white/20 hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardarFirma}
            disabled={guardando}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Confirmar Firma"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
