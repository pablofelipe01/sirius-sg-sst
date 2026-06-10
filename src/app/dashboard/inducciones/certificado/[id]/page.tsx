"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  User,
  GraduationCap,
  Award,
} from "lucide-react";
import { formatFechaColombia } from "@/shared/utils";

interface RegistroInduccion {
  id: string;
  idInduccion: string;
  nombreEmpleado: string;
  numeroDocumento: string;
  cargo: string;
  tipo: string;
  fechaRealizacion: string;
  fechaVencimiento: string;
  responsableSST: string;
  puntajeEvaluacion?: number;
  estadoEvaluacion?: string;
  certificadoUrl?: string;
  firmaUrl?: string;
  estado: string;
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
function CertificadoContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [registro, setRegistro] = useState<RegistroInduccion | null>(null);
  const [error, setError] = useState("");

  // Cargar datos de la inducción
  useEffect(() => {
    if (!id) {
      setError("ID de inducción no válido");
      setLoading(false);
      return;
    }

    const fetchInduccion = async () => {
      try {
        const res = await fetch(`/api/inducciones/${id}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "Error al cargar inducción");
          return;
        }

        setRegistro(data.data);
      } catch (err: unknown) {
        console.error("Error cargando inducción:", err);
        setError("Error al cargar la inducción");
      } finally {
        setLoading(false);
      }
    };

    fetchInduccion();
  }, [id]);

  // Generar certificado
  const handleGenerarCertificado = async () => {
    if (!registro) return;

    setGenerando(true);
    setError("");

    try {
      const res = await fetch("/api/inducciones/certificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idInduccion: registro.idInduccion }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Error al generar certificado");
        return;
      }

      // Actualizar registro con URL del certificado
      setRegistro({
        ...registro,
        certificadoUrl: data.data.certificadoUrl,
      });
    } catch (err: unknown) {
      console.error("Error generando certificado:", err);
      setError("Error al generar el certificado");
    } finally {
      setGenerando(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // Loading
  // ════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-violet-300 animate-spin mx-auto" />
          <p className="text-slate-300 text-lg font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // Error
  // ════════════════════════════════════════════════════════
  if (error && !registro) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-300" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">Error</h2>
            <p className="text-slate-300">{error}</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/inducciones")}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!registro) return null;

  // ════════════════════════════════════════════════════════
  // Vista de Certificado
  // ════════════════════════════════════════════════════════
  const fechaVenc = new Date(registro.fechaVencimiento);
  const hoy = new Date();
  const estaVigente = fechaVenc >= hoy;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push("/dashboard/inducciones")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-2 rounded-xl bg-amber-500/20">
                <Award className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">Certificado de Inducción</h1>
                <p className="text-xs text-white/60 truncate">{registro.idInduccion}</p>
              </div>
            </div>
            <Image src="/logo.png" alt="Sirius" width={128} height={36} className="h-9 w-auto hidden sm:block" priority />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Info de la Inducción */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Certificado de Inducción</h1>
                <p className="text-slate-400 font-mono">{registro.idInduccion}</p>
              </div>
            </div>

            {registro.estado === "Completada" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Completada</span>
              </div>
            )}
          </div>

          {/* Datos del Empleado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-blue-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Empleado</p>
                <p className="text-lg font-semibold text-white">{registro.nombreEmpleado}</p>
                <p className="text-sm text-slate-400">CC: {registro.numeroDocumento}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-purple-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Cargo</p>
                <p className="text-lg font-semibold text-white">{registro.cargo}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-emerald-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Fecha de Realización</p>
                <p className="text-lg font-semibold text-white">
                  {formatFechaColombia(new Date(registro.fechaRealizacion))}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-amber-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Vigencia hasta</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-white">
                    {formatFechaColombia(fechaVenc)}
                  </p>
                  <div
                    className={`w-2 h-2 rounded-full ${estaVigente ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-orange-400 mt-1" />
              <div>
                <p className="text-sm text-slate-400">Responsable SST</p>
                <p className="text-lg font-semibold text-white">{registro.responsableSST}</p>
              </div>
            </div>

            {registro.puntajeEvaluacion !== undefined && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-purple-400 mt-1" />
                <div>
                  <p className="text-sm text-slate-400">Evaluación</p>
                  <p className="text-lg font-semibold text-white">
                    {registro.puntajeEvaluacion}% - {registro.estadoEvaluacion}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Alerta de estado */}
          {registro.estado !== "Completada" && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <p className="text-amber-300">
                  Esta inducción debe estar completada y firmada para poder generar el certificado.
                </p>
              </div>
            </div>
          )}

          {/* Error al generar */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {registro.certificadoUrl ? (
              <a
                href={registro.certificadoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex-1 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <Download className="w-5 h-5" />
                Descargar Certificado PDF
              </a>
            ) : registro.estado === "Completada" ? (
              <button
                onClick={handleGenerarCertificado}
                disabled={generando}
                className="flex-1 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generando ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Award className="w-5 h-5" />
                    Generar Certificado
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 w-full px-6 py-3 rounded-xl bg-slate-700 text-slate-400 font-semibold text-center cursor-not-allowed">
                Certificado no disponible
              </div>
            )}

            {registro.firmaUrl && (
              <a
                href={registro.firmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
              >
                <FileText className="w-5 h-5" />
                Ver Firma
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Export con Suspense
// ══════════════════════════════════════════════════════════
export default function CertificadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-violet-300 animate-spin" />
        </div>
      }
    >
      <CertificadoContent />
    </Suspense>
  );
}
