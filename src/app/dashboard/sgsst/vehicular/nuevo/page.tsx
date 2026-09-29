"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Save, Loader2, Car, AlertCircle, Search } from "lucide-react";

const TIPOS_VEHICULO = ["Motocicleta", "Automóvil", "Camioneta", "Camión", "Bicicleta", "Otro"];
const TIPOS_PROPIETARIO = ["Colaborador", "Tercero", "Empresa"];

interface Colaborador {
  id: string;
  nombre: string;
  area: string;
}

export default function NuevoVehiculoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Colaboradores
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loadingColaboradores, setLoadingColaboradores] = useState(true);
  const [buscarColaborador, setBuscarColaborador] = useState("");
  const [mostrarListaColaboradores, setMostrarListaColaboradores] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    idPersonalCore: "",
    placa: "",
    tipoVehiculo: "Automóvil",
    propietarioNombre: "",
    propietarioTipo: "Colaborador",
    propietarioDocumento: "",
    observaciones: "",
  });

  useEffect(() => {
    cargarColaboradores();
  }, []);

  const cargarColaboradores = async () => {
    try {
      setLoadingColaboradores(true);
      const response = await fetch("/api/personal");
      if (!response.ok) {
        throw new Error(`Error al cargar colaboradores: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Error al cargar colaboradores");
      }

      const personal = result.data || [];

      const colaboradoresData = personal
        .filter((p: any) => p.idEmpleado && p.estado === "Activo")
        .map((p: any) => ({
          id: p.idEmpleado,
          nombre: p.nombreCompleto || "Sin nombre",
          area: Array.isArray(p.areas) && p.areas.length > 0 ? p.areas.join(", ") : "Sin área",
        }))
        .sort((a: Colaborador, b: Colaborador) => a.nombre.localeCompare(b.nombre));

      setColaboradores(colaboradoresData);

      if (colaboradoresData.length === 0) {
        setError("No se encontraron colaboradores activos");
      }
    } catch (err: any) {
      console.error("Error cargando colaboradores:", err);
      setError(err.message || "Error al cargar lista de colaboradores");
    } finally {
      setLoadingColaboradores(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validaciones
    if (!formData.idPersonalCore) {
      setError("Debe seleccionar un colaborador");
      return;
    }

    if (!formData.placa.trim()) {
      setError("La placa es requerida");
      return;
    }

    if (!formData.propietarioNombre.trim()) {
      setError("El nombre del propietario es requerido");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/sgsst/vehicular/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar vehículo");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/sgsst/vehicular/${data.vehiculo.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error al registrar vehículo");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Si se selecciona un colaborador y el propietario es "Colaborador",
    // autocompletar el nombre
    if (field === "idPersonalCore") {
      const colaborador = colaboradores.find((c) => c.id === value);
      if (colaborador && formData.propietarioTipo === "Colaborador") {
        setFormData((prev) => ({ ...prev, propietarioNombre: colaborador.nombre }));
      }
      // Cerrar la lista después de seleccionar
      setMostrarListaColaboradores(false);
      setBuscarColaborador("");
    }
  };

  const colaboradoresFiltrados = colaboradores.filter((c) =>
    c.nombre.toLowerCase().includes(buscarColaborador.toLowerCase()) ||
    c.id.toLowerCase().includes(buscarColaborador.toLowerCase())
  );

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <h1 className="text-lg font-bold text-white">Registrar Vehículo</h1>
                <p className="text-sm text-white/60">Complete la información del vehículo</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mensajes */}
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-emerald-300" />
              <p className="text-emerald-200 text-sm">
                ✓ Vehículo registrado exitosamente. Redirigiendo...
              </p>
            </div>
          )}

          {/* Colaborador */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Colaborador Asociado <span className="text-red-400">*</span>
            </h2>

            {loadingColaboradores ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Colaborador seleccionado o botón para seleccionar */}
                {formData.idPersonalCore ? (
                  <div className="bg-indigo-500/20 border-2 border-indigo-400/50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">
                          {colaboradores.find((c) => c.id === formData.idPersonalCore)?.nombre || "Colaborador"}
                        </p>
                        <p className="text-white/60 text-sm">
                          {formData.idPersonalCore} • {colaboradores.find((c) => c.id === formData.idPersonalCore)?.area || "Sin área"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarListaColaboradores(true);
                          setFormData((prev) => ({ ...prev, idPersonalCore: "" }));
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarListaColaboradores(!mostrarListaColaboradores)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white text-left transition-all flex items-center justify-between"
                  >
                    <span className="text-white/60">Seleccionar colaborador...</span>
                    <Search className="w-5 h-5 text-white/40" />
                  </button>
                )}

                {/* Dropdown de búsqueda y selección */}
                {mostrarListaColaboradores && !formData.idPersonalCore && (
                  <div className="space-y-2">
                    {/* Campo de búsqueda */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o ID..."
                        value={buscarColaborador}
                        onChange={(e) => setBuscarColaborador(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-indigo-400/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-indigo-400"
                        autoFocus
                      />
                    </div>

                    {/* Lista de colaboradores */}
                    <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg bg-white/5 border border-white/10 p-2">
                      {colaboradoresFiltrados.length === 0 ? (
                        <p className="text-white/60 text-sm text-center py-8">
                          {buscarColaborador
                            ? "No se encontraron resultados"
                            : "No hay colaboradores disponibles"}
                        </p>
                      ) : (
                        colaboradoresFiltrados.map((colaborador) => (
                          <button
                            key={colaborador.id}
                            type="button"
                            onClick={() => handleChange("idPersonalCore", colaborador.id)}
                            className="w-full text-left px-4 py-3 rounded-lg transition-all bg-white/5 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-400/30"
                          >
                            <p className="text-white font-medium">{colaborador.nombre}</p>
                            <p className="text-white/60 text-sm">{colaborador.id} • {colaborador.area}</p>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Botón para cancelar la selección */}
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarListaColaboradores(false);
                        setBuscarColaborador("");
                      }}
                      className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <p className="text-white/50 text-xs">
                  💡 Un colaborador puede tener varios vehículos registrados
                </p>
              </div>
            )}
          </div>

          {/* Información del Vehículo */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Información del Vehículo</h2>

            <div className="space-y-4">
              {/* Placa */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Placa <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.placa}
                  onChange={(e) => handleChange("placa", e.target.value.toUpperCase())}
                  placeholder="Ej: ABC123"
                  maxLength={6}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 uppercase"
                  required
                />
                <p className="text-white/50 text-xs mt-1">
                  Formato: ABC123 (autos) o ABC12D (motos)
                </p>
              </div>

              {/* Tipo de Vehículo */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Tipo de Vehículo <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.tipoVehiculo}
                  onChange={(e) => handleChange("tipoVehiculo", e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-400/50"
                  required
                >
                  {TIPOS_VEHICULO.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-gray-900">
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Información del Propietario */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Información del Propietario</h2>

            <div className="space-y-4">
              {/* Tipo de Propietario */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Tipo de Propietario <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.propietarioTipo}
                  onChange={(e) => handleChange("propietarioTipo", e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-400/50"
                  required
                >
                  {TIPOS_PROPIETARIO.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-gray-900">
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre del Propietario */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Nombre del Propietario <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.propietarioNombre}
                  onChange={(e) => handleChange("propietarioNombre", e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50"
                  required
                />
              </div>

              {/* Documento del Propietario */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Documento del Propietario
                </label>
                <input
                  type="text"
                  value={formData.propietarioDocumento}
                  onChange={(e) => handleChange("propietarioDocumento", e.target.value)}
                  placeholder="Número de documento"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50"
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Observaciones</h2>
            <textarea
              value={formData.observaciones}
              onChange={(e) => handleChange("observaciones", e.target.value)}
              placeholder="Notas adicionales sobre el vehículo..."
              rows={4}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-indigo-400/50 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/sgsst/vehicular")}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando...
                </>
              ) : success ? (
                "✓ Registrado"
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Registrar Vehículo
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
