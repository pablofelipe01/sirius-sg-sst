"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  User,
  AlertCircle,
  Award,
} from "lucide-react";
import { formatFechaColombia, getTodayColombia } from "@/shared/utils";

interface RegistroInduccion {
  id: string;
  idInduccion: string;
  idEmpleadoCore: string;
  nombreEmpleado: string;
  numeroDocumento: string;
  cargo: string;
  tipo: "Induccion" | "Reinduccion";
  fechaRealizacion: string;
  fechaVencimiento: string;
  responsableSST: string;
  evaluacionId?: string;
  puntajeEvaluacion?: number;
  estadoEvaluacion?: string;
  firmaUrl?: string;
  certificadoUrl?: string;
  estado: string;
  observaciones?: string;
}

function parseFechaCalendario(fecha: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return new Date(`${fecha}T12:00:00`);
  }

  return new Date(fecha);
}

// ══════════════════════════════════════════════════════════
// Componente Badge de Estado
// ══════════════════════════════════════════════════════════
function EstadoBadge({ estado }: { estado: string }) {
  const config = {
    En_Proceso: { bg: "bg-blue-500/20", text: "text-blue-300", label: "En Proceso" },
    Pendiente_Firma: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Pendiente Firma" },
    Completada: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Completada" },
  };

  const style = config[estado as keyof typeof config] || config.En_Proceso;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${style.bg} ${style.text}`}
    >
      {estado === "Completada" && <CheckCircle2 className="w-3.5 h-3.5" />}
      {estado === "Pendiente_Firma" && <Clock className="w-3.5 h-3.5" />}
      {style.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════
// Componente Tarjeta de Registro
// ══════════════════════════════════════════════════════════
function RegistroCard({ registro }: { registro: RegistroInduccion }) {
  const [generandoToken, setGenerandoToken] = useState(false);
  const [linkFirma, setLinkFirma] = useState<string | null>(null);

  const handleGenerarLinkFirma = async () => {
    setGenerandoToken(true);
    try {
      const res = await fetch("/api/inducciones/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idInduccion: registro.idInduccion }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(`Error: ${data.message}`);
        return;
      }

      setLinkFirma(data.data.urlFirma);

      // Copiar al portapapeles
      navigator.clipboard.writeText(data.data.urlFirma);
      alert("✅ Link copiado al portapapeles!\n\nEnvíalo al empleado para que firme su inducción.");
    } catch (error: unknown) {
      console.error("Error generando token:", error);
      alert("Error al generar el link de firma");
    } finally {
      setGenerandoToken(false);
    }
  };
  const fechaVenc = parseFechaCalendario(registro.fechaVencimiento);
  const hoy = parseFechaCalendario(getTodayColombia());
  const diasParaVencer = Math.ceil(
    (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );

  let semaforoColor = "bg-emerald-500";
  let semaforoLabel = "Vigente";

  if (diasParaVencer < 0) {
    semaforoColor = "bg-red-500";
    semaforoLabel = "Vencida";
  } else if (diasParaVencer <= 15) {
    semaforoColor = "bg-amber-500";
    semaforoLabel = "Por vencer";
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{registro.tipo}</h3>
            <p className="text-xs text-white/60 font-mono">{registro.idInduccion}</p>
          </div>
        </div>
        <EstadoBadge estado={registro.estado} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-blue-300 mt-0.5" />
          <div>
            <p className="text-xs text-white/60">Fecha Realización</p>
            <p className="text-sm text-white font-medium">
              {formatFechaColombia(registro.fechaRealizacion)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-amber-300 mt-0.5" />
          <div>
            <p className="text-xs text-white/60">Fecha Vencimiento</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-white font-medium">
                {formatFechaColombia(registro.fechaVencimiento)}
              </p>
              <div className={`w-2 h-2 rounded-full ${semaforoColor}`} title={semaforoLabel} />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-emerald-300 mt-0.5" />
          <div>
            <p className="text-xs text-white/60">Responsable SST</p>
            <p className="text-sm text-white font-medium">{registro.responsableSST}</p>
          </div>
        </div>

        {registro.puntajeEvaluacion !== undefined && (
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-violet-300 mt-0.5" />
            <div>
              <p className="text-xs text-white/60">Evaluación</p>
              <p className="text-sm text-white font-medium">
                {registro.puntajeEvaluacion}% - {registro.estadoEvaluacion}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/10">
        {/* Generar Link de Firma (solo si no está firmada) */}
        {!registro.firmaUrl && (registro.estado === "En_Proceso" || registro.estado === "Pendiente_Firma") && (
          <div className="w-full">
            {!linkFirma ? (
              <button
                onClick={handleGenerarLinkFirma}
                disabled={generandoToken}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {generandoToken ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generar Link de Firma
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30">
                <p className="text-xs text-emerald-300 font-semibold mb-2">Link generado y copiado</p>
                <input
                  type="text"
                  value={linkFirma}
                  readOnly
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white font-mono"
                />
                <p className="text-xs text-white/60 mt-2">Envia este link al empleado para que firme</p>
              </div>
            )}
          </div>
        )}

        {/* Evaluación */}
        {registro.estadoEvaluacion !== "Aprobada" && registro.estado === "Completada" && (
          <button
            onClick={() => {
              window.location.href = `/dashboard/inducciones/evaluacion/${registro.idInduccion}`;
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Iniciar Evaluación
          </button>
        )}

        {registro.estadoEvaluacion === "Aprobada" && registro.puntajeEvaluacion !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Evaluación Aprobada: {registro.puntajeEvaluacion}%
          </div>
        )}

        {/* Certificado */}
        {registro.estado === "Completada" && registro.certificadoUrl && (
          <a
            href={registro.certificadoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar Certificado
          </a>
        )}

        {/* Generar Certificado si no existe */}
        {registro.estado === "Completada" && !registro.certificadoUrl && (
          <button
            onClick={() => {
              window.location.href = `/dashboard/inducciones/certificado/${registro.id}`;
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium transition-colors"
          >
            <Award className="w-4 h-4" />
            Generar Certificado
          </button>
        )}
      </div>

      {registro.observaciones && (
        <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/10">
          <p className="text-xs text-white/60 mb-1">Observaciones:</p>
          <p className="text-sm text-slate-100">{registro.observaciones}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Contenido Principal
// ══════════════════════════════════════════════════════════
function HistorialColaboradorContent() {
  const params = useParams();
  const router = useRouter();
  const empId = params?.empId as string;

  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<RegistroInduccion[]>([]);
  const [empleado, setEmpleado] = useState<{ nombre: string; documento: string; cargo: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!empId) {
      setError("ID de empleado no válido");
      setLoading(false);
      return;
    }

    const fetchHistorial = async () => {
      try {
        const res = await fetch(`/api/inducciones/colaborador/${empId}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "Error al cargar historial");
          return;
        }

        const regs = data.data as RegistroInduccion[];
        setRegistros(regs);

        // Extraer info del empleado del primer registro
        if (regs.length > 0) {
          setEmpleado({
            nombre: regs[0].nombreEmpleado,
            documento: regs[0].numeroDocumento,
            cargo: regs[0].cargo,
          });
        }
      } catch (err: unknown) {
        console.error("Error cargando historial:", err);
        setError(err instanceof Error ? err.message : "Error al cargar historial");
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [empId]);

  // ════════════════════════════════════════════════════════
  // Loading
  // ════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-violet-300 animate-spin mx-auto" />
          <p className="text-slate-300 text-base font-medium">Cargando historial...</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // Error
  // ════════════════════════════════════════════════════════
  if (error) {
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

  // ════════════════════════════════════════════════════════
  // Historial
  // ════════════════════════════════════════════════════════
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
              <div className="p-2 rounded-xl bg-violet-500/20">
                <GraduationCap className="w-5 h-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white truncate">Historial de Inducciones</h1>
                <p className="text-xs text-white/60 truncate">{empleado ? empleado.nombre : "Colaborador"}</p>
              </div>
            </div>
            <Image src="/logo.png" alt="Sirius" width={128} height={36} className="h-9 w-auto hidden sm:block" priority />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {empleado && (
          <section className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
            <p className="text-base font-semibold text-white">{empleado.nombre}</p>
            <p className="text-sm text-white/70 mt-1">CC: {empleado.documento}</p>
            <p className="text-sm text-white/70">{empleado.cargo}</p>
          </section>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/80">
            Registros: {registros.length}
          </h2>
        </div>

        {registros.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-10 text-center">
            <GraduationCap className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white/80 mb-1">Sin inducciones registradas</h3>
            <p className="text-sm text-white/60">Este colaborador aun no tiene inducciones en el sistema</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((registro) => (
              <RegistroCard key={registro.id} registro={registro} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Export con Suspense
// ══════════════════════════════════════════════════════════
export default function HistorialColaboradorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-violet-300 animate-spin" />
        </div>
      }
    >
      <HistorialColaboradorContent />
    </Suspense>
  );
}
