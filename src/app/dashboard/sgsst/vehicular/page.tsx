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

  const cargarVehiculos = async () => {
    try {
      setLoading(true);

      // Primero verificar estado de configuración
      const diagnosticoResponse = await fetch("/api/sgsst/vehicular/diagnostico");
      if (diagnosticoResponse.ok) {
        const diagnostico = await diagnosticoResponse.json();
        if (diagnostico.estado.includes("Sin configurar")) {
          // Módulo sin configurar, mostrar mensaje amigable
          setVehiculos([]);
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/sgsst/vehicular");
      if (!response.ok) {
        // Si es 403, probablemente es problema de configuración
        if (response.status === 403) {
          setVehiculos([]);
          setLoading(false);
          return;
        }
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

        {/* Tabla de Vehículos */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
            <p className="text-white/60">Cargando vehículos...</p>
          </div>
        ) : vehiculos.length === 0 && filteredVehiculos.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-10">
            <div className="max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-amber-300" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Configuración Inicial Requerida</h2>
              <p className="text-white/70 text-lg mb-6">
                El módulo de seguimiento vehicular está implementado y funcional, pero requiere configuración de Airtable.
              </p>

              <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-6 text-left">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  Pasos para activar el módulo:
                </h3>
                <ol className="space-y-2 text-white/60">
                  <li className="flex gap-3">
                    <span className="font-bold text-amber-300">1.</span>
                    <span>Crear 4 tablas en Airtable: <code className="text-amber-300">veh_vehiculos</code>, <code className="text-amber-300">veh_documentos</code>, <code className="text-amber-300">veh_licencias</code>, <code className="text-amber-300">veh_alertas_log</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-amber-300">2.</span>
                    <span>Copiar los Field IDs de cada campo</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-amber-300">3.</span>
                    <span>Agregar las 53 variables de entorno a <code className="text-amber-300">.env.local</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-amber-300">4.</span>
                    <span>Reiniciar el servidor con <code className="text-amber-300">npm run dev</code></span>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="http://localhost:3001/api/sgsst/vehicular/diagnostico"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Circle className="w-5 h-5" />
                  Ver Estado de Configuración
                </a>
                <button
                  onClick={() => window.open('https://airtable.com/appBU8J9xGIFJSOVc', '_blank')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20"
                >
                  Abrir Airtable
                </button>
              </div>

              <div className="mt-8 p-4 bg-blue-500/10 rounded-lg border border-blue-400/30">
                <p className="text-sm text-blue-200">
                  <strong>📖 Guía completa:</strong> Revisa el archivo <code className="bg-blue-500/20 px-2 py-1 rounded">GUIA_RAPIDA_VEHICULAR.md</code> en la raíz del proyecto para instrucciones detalladas (setup en 30 minutos).
                </p>
              </div>
            </div>
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
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Colaborador
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Vehículo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      SOAT
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Tecnomecánica
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Licencia
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredVehiculos.map((vehiculo) => (
                    <tr
                      key={vehiculo.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-4">
                        {getBadgeEstado(vehiculo.estadoConsolidado)}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-white">{vehiculo.nombreColaborador}</p>
                          <p className="text-sm text-white/60">{vehiculo.areaColaborador}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
                            {getIconoVehiculo(vehiculo.tipoVehiculo)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{vehiculo.placa}</p>
                            <p className="text-sm text-white/60">{vehiculo.tipoVehiculo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.soat.estado)}`} />
                          <span className="text-xs text-white/60">
                            {formatDiasRestantes(vehiculo.soat.diasRestantes)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.tecnomecanica.estado)}`} />
                          <span className="text-xs text-white/60">
                            {formatDiasRestantes(vehiculo.tecnomecanica.diasRestantes)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Circle className={`w-4 h-4 fill-current ${getSemaforoColor(vehiculo.licencia.estado)}`} />
                          <span className="text-xs text-white/60">
                            {vehiculo.licencia.categoria || "Sin licencia"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => router.push(`/dashboard/sgsst/vehicular/${vehiculo.id}`)}
                          className="text-indigo-300 hover:text-indigo-200 font-medium text-sm"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
