"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Loader2, Car, Calendar, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface VehiculoDetalle {
  id: string;
  idPersonalCore: string;
  nombreColaborador: string;
  areaColaborador: string;
  placa: string;
  tipoVehiculo: string;
  propietarioNombre: string;
  propietarioTipo: string;
  propietarioDocumento: string;
  soat: {
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
  };
  tecnomecanica: {
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
  };
  licencia: {
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
    categoria: string | null;
  };
  estadoConsolidado: "ok" | "alerta" | "critico";
}

export default function VehiculoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [vehiculo, setVehiculo] = useState<VehiculoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarVehiculo();
  }, [resolvedParams.id]);

  const cargarVehiculo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sgsst/vehicular/vehiculos/${resolvedParams.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Vehículo no encontrado");
        } else {
          setError("Error al cargar vehículo");
        }
        return;
      }

      const data = await response.json();
      if (data.success && data.vehiculo) {
        setVehiculo(data.vehiculo);
      } else {
        setError("Vehículo no encontrado");
      }
    } catch (err) {
      console.error("Error cargando vehículo:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return "Sin registro";
    try {
      return new Date(fecha).toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return fecha;
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "Vigente":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <CheckCircle className="w-4 h-4" />
            Vigente
          </span>
        );
      case "Por vencer":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Clock className="w-4 h-4" />
            Por vencer
          </span>
        );
      case "Vencido":
      case "Vencida":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-500/20 text-red-300 border border-red-400/30">
            <AlertCircle className="w-4 h-4" />
            Vencido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-500/20 text-gray-300 border border-gray-400/30">
            Sin registro
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !vehiculo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-16 h-16 text-red-400" />
        <p className="text-white text-lg">{error || "Vehículo no encontrado"}</p>
        <button
          onClick={() => router.push("/dashboard/sgsst/vehicular")}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-5">
            <button
              onClick={() => router.push("/dashboard/sgsst/vehicular")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 backdrop-blur-sm">
                <Car className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Detalle del Vehículo</h1>
                <p className="text-sm text-white/60">Placa {vehiculo.placa}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-6">
          {/* Información del Vehículo */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Car className="w-5 h-5" />
              Información del Vehículo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-white/50 mb-1">Placa</p>
                <p className="text-lg font-semibold text-white">{vehiculo.placa}</p>
              </div>
              <div>
                <p className="text-sm text-white/50 mb-1">Tipo</p>
                <p className="text-lg font-semibold text-white">{vehiculo.tipoVehiculo}</p>
              </div>
              <div>
                <p className="text-sm text-white/50 mb-1">Colaborador Asignado</p>
                <p className="text-lg font-semibold text-white">{vehiculo.nombreColaborador}</p>
              </div>
              <div>
                <p className="text-sm text-white/50 mb-1">Área</p>
                <p className="text-lg font-semibold text-white">{vehiculo.areaColaborador}</p>
              </div>
            </div>

            {/* Información del Propietario - Sección destacada */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Información del Propietario</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-white/50 mb-1">Nombre del Propietario</p>
                  <p className="text-lg font-semibold text-white">{vehiculo.propietarioNombre}</p>
                </div>
                <div>
                  <p className="text-sm text-white/50 mb-1">Tipo de Propietario</p>
                  <p className="text-lg font-semibold text-white">{vehiculo.propietarioTipo}</p>
                </div>
                <div>
                  <p className="text-sm text-white/50 mb-1">Documento del Propietario</p>
                  <p className="text-lg font-semibold text-white">
                    {vehiculo.propietarioDocumento || 'No registrado'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SOAT */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  SOAT
                </h3>
                {getEstadoBadge(vehiculo.soat.estado)}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-white/50 mb-1">Fecha de Vencimiento</p>
                  <p className="text-base font-medium text-white">{formatFecha(vehiculo.soat.fechaVencimiento)}</p>
                </div>
                {vehiculo.soat.diasRestantes !== null && (
                  <div>
                    <p className="text-sm text-white/50 mb-1">Días Restantes</p>
                    <p className={`text-2xl font-bold ${
                      vehiculo.soat.diasRestantes < 0 ? "text-red-400" :
                      vehiculo.soat.diasRestantes <= 30 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {vehiculo.soat.diasRestantes < 0 ? `${Math.abs(vehiculo.soat.diasRestantes)} días vencido` : `${vehiculo.soat.diasRestantes} días`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Tecnomecánica */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Tecnomecánica
                </h3>
                {getEstadoBadge(vehiculo.tecnomecanica.estado)}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-white/50 mb-1">Fecha de Vencimiento</p>
                  <p className="text-base font-medium text-white">{formatFecha(vehiculo.tecnomecanica.fechaVencimiento)}</p>
                </div>
                {vehiculo.tecnomecanica.diasRestantes !== null && (
                  <div>
                    <p className="text-sm text-white/50 mb-1">Días Restantes</p>
                    <p className={`text-2xl font-bold ${
                      vehiculo.tecnomecanica.diasRestantes < 0 ? "text-red-400" :
                      vehiculo.tecnomecanica.diasRestantes <= 30 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {vehiculo.tecnomecanica.diasRestantes < 0 ? `${Math.abs(vehiculo.tecnomecanica.diasRestantes)} días vencido` : `${vehiculo.tecnomecanica.diasRestantes} días`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Licencia */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Licencia de Conducción
              </h3>
              {getEstadoBadge(vehiculo.licencia.estado)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-white/50 mb-1">Categoría</p>
                <p className="text-lg font-semibold text-white">{vehiculo.licencia.categoria || "Sin registro"}</p>
              </div>
              <div>
                <p className="text-sm text-white/50 mb-1">Fecha de Vencimiento</p>
                <p className="text-base font-medium text-white">{formatFecha(vehiculo.licencia.fechaVencimiento)}</p>
              </div>
              {vehiculo.licencia.diasRestantes !== null && (
                <div>
                  <p className="text-sm text-white/50 mb-1">Días Restantes</p>
                  <p className={`text-2xl font-bold ${
                    vehiculo.licencia.diasRestantes < 0 ? "text-red-400" :
                    vehiculo.licencia.diasRestantes <= 30 ? "text-amber-400" :
                    "text-emerald-400"
                  }`}>
                    {vehiculo.licencia.diasRestantes < 0 ? `${Math.abs(vehiculo.licencia.diasRestantes)} días vencida` : `${vehiculo.licencia.diasRestantes} días`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
