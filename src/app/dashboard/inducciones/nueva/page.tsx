"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Save,
  CheckCircle2,
  Calendar,
  User,
  Briefcase,
  FileText,
  AlertCircle,
} from "lucide-react";
import { modulosInduccion } from "@/infrastructure/config/airtableInducciones";
import type { TipoInduccion } from "@/shared/types/inducciones";

interface Empleado {
  idEmpleadoCore: string;
  nombreCompleto: string;
  numeroDocumento: string;
  cargo: string;
}

const RESPONSABLE_SST_FIJO_FALLBACK = "María Alejandra";

function getFechaHoyBogota(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().split("T")[0];
  }

  return `${year}-${month}-${day}`;
}

function NuevaInduccionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const empIdFromUrl = searchParams.get("emp");

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>("");
  const [tipo, setTipo] = useState<TipoInduccion>("Induccion");
  const [fechaRealizacion, setFechaRealizacion] = useState<string>(getFechaHoyBogota());
  const [responsableSST, setResponsableSST] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const colaboradorBloqueado = !!empIdFromUrl && empleados.some((e) => e.idEmpleadoCore === empIdFromUrl);

  useEffect(() => {
    cargarEmpleados();
  }, []);

  useEffect(() => {
    cargarResponsableSST();
  }, []);

  useEffect(() => {
    if (empIdFromUrl && empleados.length > 0) {
      const existeEmpleado = empleados.some((e) => e.idEmpleadoCore === empIdFromUrl);
      if (existeEmpleado) {
        setEmpleadoSeleccionado(empIdFromUrl);
      }
    }
  }, [empIdFromUrl, empleados]);

  const cargarEmpleados = async () => {
    try {
      setLoadingEmpleados(true);
      const response = await fetch("/api/inducciones/dashboard");
      const data = await response.json();

      if (data.success) {
        // Extraer solo los datos básicos que necesitamos
        const emps = data.data.map((e: any) => ({
          idEmpleadoCore: e.idEmpleadoCore,
          nombreCompleto: e.nombreCompleto,
          numeroDocumento: e.numeroDocumento,
          cargo: e.cargo,
        }));
        setEmpleados(emps);
      }
    } catch (error) {
      console.error("Error cargando empleados:", error);
      setError("Error al cargar la lista de empleados");
    } finally {
      setLoadingEmpleados(false);
    }
  };

  const cargarResponsableSST = async () => {
    try {
      const response = await fetch("/api/registros-asistencia/conferencista");
      const data = await response.json();

      if (data.success && data.nombre) {
        setResponsableSST(data.nombre);
        return;
      }
    } catch {
      // Si falla el endpoint, usar nombre fijo definido por negocio.
    }

    setResponsableSST(RESPONSABLE_SST_FIJO_FALLBACK);
  };

  const empleadoActual = empleados.find((e) => e.idEmpleadoCore === empleadoSeleccionado);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!empleadoSeleccionado || !fechaRealizacion || !responsableSST) {
        setError("Por favor completa todos los campos obligatorios");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/inducciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idEmpleadoCore: empleadoSeleccionado,
          tipo,
          fechaRealizacion,
          responsableSST,
          observaciones: observaciones || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard/inducciones");
        }, 2000);
      } else {
        setError(data.message || "Error al crear la inducción");
      }
    } catch (error: any) {
      console.error("Error:", error);
      setError("Error al guardar la inducción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="Sirius" width={240} height={64} className="h-16 w-auto" priority />
              <div className="hidden sm:block h-8 w-px bg-white/20" />
              <p className="hidden sm:block text-sm font-semibold text-white/70 tracking-wide uppercase">
                Registrar Inducción
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/inducciones")}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              Volver
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Success Message */}
        {success && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-xl border border-green-400/30 p-6 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-400" size={32} />
              <div>
                <h3 className="text-xl font-bold text-white">¡Inducción Registrada!</h3>
                <p className="text-white/70">Redirigiendo al dashboard...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl rounded-xl border border-red-400/30 p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-400" size={32} />
              <div>
                <h3 className="text-xl font-bold text-white">Error</h3>
                <p className="text-white/70">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card Principal */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-8">
            <h1 className="text-3xl font-bold text-white mb-6">Registrar Nueva Inducción</h1>

            <div className="space-y-6">
              {/* Tipo de Inducción */}
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">
                  Tipo de Inducción *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTipo("Induccion")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      tipo === "Induccion"
                        ? "border-blue-400 bg-blue-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold mb-1">Inducción</div>
                    <div className="text-xs opacity-80">Para nuevos trabajadores</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("Reinduccion")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      tipo === "Reinduccion"
                        ? "border-emerald-400 bg-emerald-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold mb-1">Reinducción</div>
                    <div className="text-xs opacity-80">Actualización anual</div>
                  </button>
                </div>
              </div>

              {/* Seleccionar Colaborador */}
              <div>
                <label htmlFor="empleado" className="block text-sm font-semibold text-white/80 mb-2">
                  Seleccionar Colaborador *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                  <select
                    id="empleado"
                    value={empleadoSeleccionado}
                    onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
                    disabled={loadingEmpleados || colaboradorBloqueado}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50"
                    required
                  >
                    <option value="">
                      {loadingEmpleados ? "Cargando..." : "Seleccione un colaborador"}
                    </option>
                    {empleados.map((emp) => (
                      <option key={emp.idEmpleadoCore} value={emp.idEmpleadoCore}>
                        {emp.nombreCompleto} - {emp.numeroDocumento}
                      </option>
                    ))}
                  </select>
                </div>
                {colaboradorBloqueado && (
                  <p className="mt-2 text-xs text-white/60">
                    Colaborador preseleccionado desde el historial de inducciones.
                  </p>
                )}
              </div>

              {/* Datos del Colaborador (Read-only) */}
              {empleadoActual && (
                <div className="bg-blue-500/10 rounded-xl border border-blue-400/30 p-4">
                  <h3 className="text-sm font-semibold text-blue-300 mb-3">Datos del Colaborador</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-white/50 mb-1">Nombre Completo</div>
                      <div className="text-white font-medium">{empleadoActual.nombreCompleto}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Documento</div>
                      <div className="text-white font-medium">{empleadoActual.numeroDocumento}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Cargo</div>
                      <div className="text-white font-medium">{empleadoActual.cargo}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fecha de Realización */}
              <div>
                <label htmlFor="fecha" className="block text-sm font-semibold text-white/80 mb-2">
                  Fecha de Realización *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="date"
                    id="fecha"
                    value={fechaRealizacion}
                    onChange={(e) => setFechaRealizacion(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    required
                  />
                </div>
              </div>

              {/* Responsable SST */}
              <div>
                <label htmlFor="responsable" className="block text-sm font-semibold text-white/80 mb-2">
                  Responsable SST *
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    id="responsable"
                    value={responsableSST}
                    readOnly
                    placeholder="Responsable SST"
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  Responsable SST asignado automáticamente por configuración del sistema.
                </p>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="observaciones" className="block text-sm font-semibold text-white/80 mb-2">
                  Observaciones (Opcional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-white/40" size={20} />
                  <textarea
                    id="observaciones"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas adicionales sobre la inducción..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Módulos Temáticos (Informativo) */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Módulos Cubiertos en la Inducción</h2>
            <p className="text-white/70 mb-6">
              Los siguientes módulos son parte del programa de inducción estándar:
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Módulo Administrativa */}
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-400/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="text-blue-400" size={20} />
                  <h3 className="font-bold text-white">{modulosInduccion.administrativa.nombre}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-white/70">
                  {modulosInduccion.administrativa.temas.map((tema, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{tema}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Módulo SST */}
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl border border-emerald-400/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <h3 className="font-bold text-white">{modulosInduccion.sst.nombre}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-white/70">
                  {modulosInduccion.sst.temas.slice(0, 8).map((tema, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{tema}</span>
                    </li>
                  ))}
                  <li className="text-xs text-white/50 italic">+ {modulosInduccion.sst.temas.length - 8} temas más</li>
                </ul>
              </div>

              {/* Módulo Medio Ambiente */}
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-400/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="text-green-400" size={20} />
                  <h3 className="font-bold text-white">{modulosInduccion.medioAmbiente.nombre}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-white/70">
                  {modulosInduccion.medioAmbiente.temas.map((tema, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span>{tema}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard/inducciones")}
              className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save size={20} />
                  Guardar Inducción
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NuevaInduccionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="text-white">Cargando...</div>
    </div>}>
      <NuevaInduccionForm />
    </Suspense>
  );
}
