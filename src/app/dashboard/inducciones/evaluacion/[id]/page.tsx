"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ChevronLeft, FileText, Loader2 } from "lucide-react";
import EvaluacionInduccion from "@/components/evaluaciones/EvaluacionInduccion";

interface InduccionDetail {
  id: string;
  idInduccion: string;
  idEmpleadoCore: string;
  nombreEmpleado: string;
  numeroDocumento: string;
  cargo: string;
  tipo: "Induccion" | "Reinduccion";
  estadoEvaluacion?: string;
  puntajeEvaluacion?: number | null;
}

function EvaluacionInduccionPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [induccion, setInduccion] = useState<InduccionDetail | null>(null);

  useEffect(() => {
    if (!id) {
      setError("ID de inducción no válido");
      setLoading(false);
      return;
    }

    const fetchInduccion = async () => {
      try {
        const res = await fetch(`/api/inducciones/${id}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.message || "No se pudo cargar la inducción");
        }

        setInduccion(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar inducción");
      } finally {
        setLoading(false);
      }
    };

    fetchInduccion();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-violet-300 animate-spin mx-auto" />
          <p className="text-slate-300">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (error || !induccion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">Error</h2>
            <p className="text-slate-300">{error || "No se pudo cargar la evaluación"}</p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Evaluación de Inducción</h1>
                <p className="text-sm text-white/70">
                  {induccion.nombreEmpleado} - {induccion.idInduccion}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/dashboard/inducciones/colaborador/${induccion.idEmpleadoCore}`)}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </header>

        <section className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
          <EvaluacionInduccion
            induccionId={induccion.idInduccion}
            idEmpleadoCore={induccion.idEmpleadoCore}
            nombreEmpleado={induccion.nombreEmpleado}
            numeroDocumento={induccion.numeroDocumento}
            cargo={induccion.cargo}
            onAprobada={() => {
              setTimeout(() => {
                router.push(`/dashboard/inducciones/colaborador/${induccion.idEmpleadoCore}`);
              }, 1200);
            }}
            onReprobada={() => {
              setTimeout(() => {
                router.push(`/dashboard/inducciones/colaborador/${induccion.idEmpleadoCore}`);
              }, 1200);
            }}
          />
        </section>
      </main>
    </div>
  );
}

export default function EvaluacionInduccionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-violet-300 animate-spin" />
        </div>
      }
    >
      <EvaluacionInduccionPageContent />
    </Suspense>
  );
}
