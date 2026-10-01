"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Loader2, Car, Calendar, FileText, AlertCircle, CheckCircle, Clock, Edit2, Save, X } from "lucide-react";

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
    id: string | null;
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
  };
  tecnomecanica: {
    id: string | null;
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
  };
  licencia: {
    id: string | null;
    estado: string;
    fechaVencimiento: string | null;
    diasRestantes: number | null;
    categoria: string | null;
  };
  estadoConsolidado: "ok" | "alerta" | "critico";
}

const CATEGORIAS_LICENCIA = ["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"];

export default function VehiculoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [vehiculo, setVehiculo] = useState<VehiculoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para formularios de edición
  const [editandoSoat, setEditandoSoat] = useState(false);
  const [editandoTecno, setEditandoTecno] = useState(false);
  const [editandoLicencia, setEditandoLicencia] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados para formularios
  const [soatFecha, setSoatFecha] = useState("");
  const [tecnoFecha, setTecnoFecha] = useState("");
  const [licenciaFecha, setLicenciaFecha] = useState("");
  const [licenciaCategoria, setLicenciaCategoria] = useState("");

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
        // Inicializar formularios con valores actuales
        setSoatFecha(data.vehiculo.soat.fechaVencimiento || "");
        setTecnoFecha(data.vehiculo.tecnomecanica.fechaVencimiento || "");
        setLicenciaFecha(data.vehiculo.licencia.fechaVencimiento || "");
        setLicenciaCategoria(data.vehiculo.licencia.categoria || "");
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

  const guardarDocumento = async (tipo: "SOAT" | "Tecnomecánica") => {
    if (!vehiculo) return;

    try {
      setGuardando(true);
      const fecha = tipo === "SOAT" ? soatFecha : tecnoFecha;
      const docId = tipo === "SOAT" ? vehiculo.soat.id : vehiculo.tecnomecanica.id;

      if (!fecha) {
        alert("La fecha de vencimiento es obligatoria");
        return;
      }

      const payload = docId
        ? { id: docId, fechaVencimiento: fecha }
        : { vehiculoId: vehiculo.id, tipoDocumento: tipo, fechaVencimiento: fecha };

      const response = await fetch("/api/sgsst/vehicular/documentos", {
        method: docId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Error al guardar documento");
      }

      // Recargar datos
      await cargarVehiculo();
      setEditandoSoat(false);
      setEditandoTecno(false);
      alert(`${tipo} actualizado exitosamente`);
    } catch (err) {
      console.error("Error guardando documento:", err);
      alert("Error al guardar. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarLicencia = async () => {
    if (!vehiculo) return;

    try {
      setGuardando(true);

      if (!licenciaFecha || !licenciaCategoria) {
        alert("La fecha de vencimiento y categoría son obligatorias");
        return;
      }

      const payload = vehiculo.licencia.id
        ? { id: vehiculo.licencia.id, fechaVencimiento: licenciaFecha, categoria: licenciaCategoria }
        : {
            idPersonalCore: vehiculo.idPersonalCore,
            numeroLicencia: "N/A",
            categoria: licenciaCategoria,
            fechaVencimiento: licenciaFecha,
          };

      const response = await fetch("/api/sgsst/vehicular/licencias", {
        method: vehiculo.licencia.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar licencia");
      }

      // Recargar datos
      await cargarVehiculo();
      setEditandoLicencia(false);
      alert("Licencia actualizada exitosamente");
    } catch (err: any) {
      console.error("Error guardando licencia:", err);
      alert(err.message || "Error al guardar. Intente nuevamente.");
    } finally {
      setGuardando(false);
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

              {!editandoSoat ? (
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
                  <button
                    onClick={() => setEditandoSoat(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-all border border-indigo-400/30"
                  >
                    <Edit2 className="w-4 h-4" />
                    Actualizar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/50 mb-2">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={soatFecha}
                      onChange={(e) => setSoatFecha(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardarDocumento("SOAT")}
                      disabled={guardando}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all border border-emerald-400/30 disabled:opacity-50"
                    >
                      {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setEditandoSoat(false);
                        setSoatFecha(vehiculo.soat.fechaVencimiento || "");
                      }}
                      disabled={guardando}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-400/30 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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

              {!editandoTecno ? (
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
                  <button
                    onClick={() => setEditandoTecno(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-all border border-indigo-400/30"
                  >
                    <Edit2 className="w-4 h-4" />
                    Actualizar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/50 mb-2">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={tecnoFecha}
                      onChange={(e) => setTecnoFecha(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardarDocumento("Tecnomecánica")}
                      disabled={guardando}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all border border-emerald-400/30 disabled:opacity-50"
                    >
                      {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setEditandoTecno(false);
                        setTecnoFecha(vehiculo.tecnomecanica.fechaVencimiento || "");
                      }}
                      disabled={guardando}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-400/30 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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

            {!editandoLicencia ? (
              <div className="space-y-4">
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
                <button
                  onClick={() => setEditandoLicencia(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-all border border-indigo-400/30"
                >
                  <Edit2 className="w-4 h-4" />
                  Actualizar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/50 mb-2">Categoría *</label>
                    <select
                      value={licenciaCategoria}
                      onChange={(e) => setLicenciaCategoria(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="" className="bg-gray-900">Seleccione...</option>
                      {CATEGORIAS_LICENCIA.map((cat) => (
                        <option key={cat} value={cat} className="bg-gray-900">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 mb-2">Fecha de Vencimiento *</label>
                    <input
                      type="date"
                      value={licenciaFecha}
                      onChange={(e) => setLicenciaFecha(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={guardarLicencia}
                    disabled={guardando}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all border border-emerald-400/30 disabled:opacity-50"
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditandoLicencia(false);
                      setLicenciaFecha(vehiculo.licencia.fechaVencimiento || "");
                      setLicenciaCategoria(vehiculo.licencia.categoria || "");
                    }}
                    disabled={guardando}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-400/30 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
