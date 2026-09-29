"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  Plus,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Car,
  Bike,
  Truck,
  Circle,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type EstadoConsolidado = "ok" | "alerta" | "critico";
type TipoVehiculo = "Motocicleta" | "Automóvil" | "Camioneta" | "Camión" | "Bicicleta" | "Otro";

interface Vehiculo {
  id: string;
  idPersonalCore: string;
  nombreColaborador: string;
  areaColaborador: string;
  placa: string;
  tipoVehiculo: TipoVehiculo;
  propietarioNombre: string;
  propietarioTipo: string;
  activo: boolean;
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
  estadoConsolidado: EstadoConsolidado;
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function SeguimientoVehicularPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [filteredVehiculos, setFilteredVehiculos] = useState<Vehiculo[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoConsolidado | "todos">("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoVehiculo | "todos">("todos");

  // Estadísticas
  const [stats, setStats] = useState({
    totalVehiculos: 0,
    documentosPorVencer: 0,
    documentosVencidos: 0,
    licenciasPorVencer: 0,
  });

  useEffect(() => {
    cargarVehiculos();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [vehiculos, searchTerm, estadoFilter, tipoFilter]);

  // Agrupar vehículos por colaborador
  const vehiculosPorColaborador = filteredVehiculos.reduce((acc, vehiculo) => {
    const key = vehiculo.idPersonalCore || 'sin-asignar';
    if (!acc[key]) {
      acc[key] = {
        colaborador: {
          id: vehiculo.idPersonalCore,
          nombre: vehiculo.nombreColaborador,
          area: vehiculo.areaColaborador,
        },
        vehiculos: [],
      };
    }
    acc[key].vehiculos.push(vehiculo);
    return acc;
  }, {} as Record<string, { colaborador: { id: string; nombre: string; area: string }; vehiculos: Vehiculo[] }>);

  const colaboradoresOrdenados = Object.values(vehiculosPorColaborador).sort((a, b) =>
    a.colaborador.nombre.localeCompare(b.colaborador.nombre)
  );

  const cargarVehiculos = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/sgsst/vehicular");
      if (!response.ok) {
        throw new Error("Error al cargar vehículos");
      }

      const data = await response.json();
      setVehiculos(data.vehiculos || []);

      // Calcular estadísticas
      const docs = data.vehiculos || [];
      setStats({
        totalVehiculos: docs.filter((v: Vehiculo) => v.activo).length,
        documentosPorVencer: docs.filter((v: Vehiculo) =>
          v.soat.estado === "Por vencer" || v.tecnomecanica.estado === "Por vencer"
        ).length,
        documentosVencidos: docs.filter((v: Vehiculo) =>
          v.soat.estado === "Vencido" || v.tecnomecanica.estado === "Vencido"
        ).length,
        licenciasPorVencer: docs.filter((v: Vehiculo) =>
          v.licencia.estado === "Por vencer" || v.licencia.estado === "Vencida"
        ).length,
      });
    } catch (error) {
      console.error("Error cargando vehículos:", error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let filtered = [...vehiculos];

    // Filtro de búsqueda (nombre, placa)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.nombreColaborador.toLowerCase().includes(term) ||
          v.placa.toLowerCase().includes(term) ||
          v.areaColaborador.toLowerCase().includes(term)
      );
    }

    // Filtro de estado consolidado
    if (estadoFilter !== "todos") {
      filtered = filtered.filter((v) => v.estadoConsolidado === estadoFilter);
    }

    // Filtro de tipo de vehículo
    if (tipoFilter !== "todos") {
      filtered = filtered.filter((v) => v.tipoVehiculo === tipoFilter);
    }

    setFilteredVehiculos(filtered);
  };

  const getIconoVehiculo = (tipo: TipoVehiculo) => {
    switch (tipo) {
      case "Motocicleta":
        return <Bike className="w-5 h-5" />;
      case "Camión":
        return <Truck className="w-5 h-5" />;
      default:
        return <Car className="w-5 h-5" />;
    }
  };

  const getSemaforoColor = (estado: string) => {
    switch (estado) {
      case "Vigente":
        return "text-emerald-400";
      case "Por vencer":
      case "Por vencer":
        return "text-amber-400";
      case "Vencido":
      case "Vencida":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getBadgeEstado = (estadoConsolidado: EstadoConsolidado) => {
    switch (estadoConsolidado) {
      case "ok":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <CheckCircle className="w-3.5 h-3.5" />
            OK
          </span>
        );
      case "alerta":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Clock className="w-3.5 h-3.5" />
            Alerta
          </span>
        );
      case "critico":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Crítico
          </span>
        );
    }
  };

  const formatDiasRestantes = (dias: number | null) => {
    if (dias === null) return "Sin registro";
    if (dias < 0) return `Vencido (${Math.abs(dias)}d)`;
    return `${dias} días`;
  };

  return (
    <div className="min-h-screen relative">
      {/* Background image */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/20032025-DSC_3717.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Volver al Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <h1 className="text-xl font-bold text-white">Seguimiento Vehicular</h1>
            </div>

            <button
              onClick={() => router.push("/dashboard/sgsst/vehicular/nuevo")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Registrar Vehículo
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60 font-medium">Vehículos Activos</p>
                <p className="text-3xl font-bold text-white mt-1">{stats.totalVehiculos}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Car className="w-6 h-6 text-indigo-300" />
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60 font-medium">Docs. Por Vencer</p>
                <p className="text-3xl font-bold text-amber-300 mt-1">{stats.documentosPorVencer}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-300" />
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60 font-medium">Docs. Vencidos</p>
                <p className="text-3xl font-bold text-red-300 mt-1">{stats.documentosVencidos}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-300" />
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60 font-medium">Licencias Alerta</p>
                <p className="text-3xl font-bold text-amber-300 mt-1">{stats.licenciasPorVencer}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Buscar por nombre, placa o área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filtro de Estado */}
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="ok">OK (Verde)</option>
              <option value="alerta">Alerta (Amarillo)</option>
              <option value="critico">Crítico (Rojo)</option>
            </select>

            {/* Filtro de Tipo */}
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todos">Todos los tipos</option>
              <option value="Motocicleta">Motocicleta</option>
              <option value="Automóvil">Automóvil</option>
              <option value="Camioneta">Camioneta</option>
              <option value="Camión">Camión</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-white/60">
              Mostrando {filteredVehiculos.length} de {vehiculos.length} vehículos
            </span>
            <button
              onClick={() => {
                setSearchTerm("");
                setEstadoFilter("todos");
                setTipoFilter("todos");
              }}
              className="text-indigo-300 hover:text-indigo-200 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Lista de Colaboradores y sus Vehículos */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
            <p className="text-white/60">Cargando vehículos...</p>
          </div>
        ) : filteredVehiculos.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-10 text-center">
            <Car className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No se encontraron vehículos</p>
            <p className="text-white/40 text-sm mt-2">
              {searchTerm || estadoFilter !== "todos" || tipoFilter !== "todos"
                ? "Intenta ajustar los filtros"
                : "Comienza registrando un vehículo"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {colaboradoresOrdenados.map(({ colaborador, vehiculos: vehiculosColaborador }) => (
              <div
                key={colaborador.id}
                className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 overflow-hidden"
              >
                {/* Header del Colaborador */}
                <div className="bg-white/5 px-6 py-4 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{colaborador.nombre}</h3>
                      <p className="text-sm text-white/60">{colaborador.area}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium">
                        {vehiculosColaborador.length} {vehiculosColaborador.length === 1 ? 'vehículo' : 'vehículos'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de Vehículos del Colaborador */}
                <div className="divide-y divide-white/10">
                  {vehiculosColaborador.map((vehiculo) => (
                    <div
                      key={vehiculo.id}
                      className="px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        {/* Estado */}
                        <div className="flex items-center gap-3">
                          {getBadgeEstado(vehiculo.estadoConsolidado)}
                        </div>

                        {/* Vehículo */}
                        <div className="flex items-center gap-3 md:col-span-2">
                          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
                            {getIconoVehiculo(vehiculo.tipoVehiculo)}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-lg">{vehiculo.placa}</p>
                            <p className="text-sm text-white/60">{vehiculo.tipoVehiculo}</p>
                          </div>
                        </div>

                        {/* Documentos - Grid 3 columnas */}
                        <div className="grid grid-cols-3 gap-3 md:col-span-2">
                          {/* SOAT */}
                          <div className="text-center">
                            <p className="text-xs text-white/50 mb-1">SOAT</p>
                            <div className="flex flex-col items-center gap-1">
                              <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.soat.estado)}`} />
                              <span className="text-xs text-white/70 font-medium">
                                {formatDiasRestantes(vehiculo.soat.diasRestantes)}
                              </span>
                            </div>
                          </div>

                          {/* Tecnomecánica */}
                          <div className="text-center">
                            <p className="text-xs text-white/50 mb-1">Tecno</p>
                            <div className="flex flex-col items-center gap-1">
                              <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.tecnomecanica.estado)}`} />
                              <span className="text-xs text-white/70 font-medium">
                                {formatDiasRestantes(vehiculo.tecnomecanica.diasRestantes)}
                              </span>
                            </div>
                          </div>

                          {/* Licencia */}
                          <div className="text-center">
                            <p className="text-xs text-white/50 mb-1">Licencia</p>
                            <div className="flex flex-col items-center gap-1">
                              <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.licencia.estado)}`} />
                              <span className="text-xs text-white/70 font-medium">
                                {vehiculo.licencia.categoria || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => router.push(`/dashboard/sgsst/vehicular/${vehiculo.id}`)}
                            className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg font-medium text-sm transition-colors"
                          >
                            Ver detalle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
