"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Save,
  History,
  Flame,
  Cross,
  ShieldAlert,
  Droplets,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type TipoInspeccion = "Extintor" | "Botiquín" | "Camilla" | "Kit Derrames";

type EstadoCriterio = "Bueno" | "Regular" | "Malo" | "NA" | null;
type EstadoElemento = "Bueno" | "Regular" | "Malo" | "Faltante" | null;

interface ExtintorItem {
  id: string;
  codigo: string;
  numero: number;
  nombre: string;
  capacidad: string;
  claseAgente: string[];
  fechaRecarga: string | null;
}

interface BotiquinItem {
  id: string;
  codigo: string;
  nombre: string;
}

interface CamillaItem {
  id: string;
  codigo: string;
  nombre: string;
}

interface KitItem {
  id: string;
  codigo: string;
  nombre: string;
}

interface ElementoItem {
  id: string;
  codigo: string;
  nombre: string;
  cantidadEstandar?: number;
  requiereVencimiento?: boolean;
  unidad?: string;
}

interface ResponsableSST {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
}

// Estados de criterios para extintor
interface CriteriosExtintor {
  presion: EstadoCriterio;
  selloGarantia: EstadoCriterio;
  manometro: EstadoCriterio;
  estadoCilindro: EstadoCriterio;
  manija: EstadoCriterio;
  boquillaManguera: EstadoCriterio;
  anilloSeguridad: EstadoCriterio;
  pinSeguridad: EstadoCriterio;
  pintura: EstadoCriterio;
  tarjetaInspeccion: EstadoCriterio;
  observaciones: string;
}

// Estado de elemento para Botiquín/Camilla/Kit
interface EstadoElementoInsp {
  estadoElemento: EstadoElemento;
  cantidad: number;
  fechaVencimiento?: string;
  observaciones: string;
}

// Estado de verificación para Kit Derrames
interface VerificacionKit {
  conoceProcedimiento: boolean;
  almacenamientoAdecuado: boolean;
  rotuladoSenalizado: boolean;
}

interface ResponsableInspeccion {
  tipo: "Inspector" | "Responsable SG-SST" | "COPASST";
  nombre: string;
  cedula: string;
  cargo: string;
}

type PageState = "idle" | "saving" | "success" | "error";

// ══════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════
const TIPOS_INSPECCION: { tipo: TipoInspeccion; icon: React.ReactNode; color: string; descripcion: string }[] = [
  { tipo: "Extintor", icon: <Flame className="w-8 h-8" />, color: "bg-red-500/20 border-red-500/30 text-red-400", descripcion: "FT-SST-033" },
  { tipo: "Botiquín", icon: <Cross className="w-8 h-8" />, color: "bg-green-500/20 border-green-500/30 text-green-400", descripcion: "FT-SST-032" },
  { tipo: "Camilla", icon: <ShieldAlert className="w-8 h-8" />, color: "bg-blue-500/20 border-blue-500/30 text-blue-400", descripcion: "FT-SST-037" },
  { tipo: "Kit Derrames", icon: <Droplets className="w-8 h-8" />, color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400", descripcion: "FT-SST-050" },
];

const CRITERIOS_EXTINTOR_LABELS = [
  { key: "presion", label: "Presión" },
  { key: "selloGarantia", label: "Sello de Garantía" },
  { key: "manometro", label: "Manómetro" },
  { key: "estadoCilindro", label: "Estado del Cilindro" },
  { key: "manija", label: "Manija" },
  { key: "boquillaManguera", label: "Boquilla / Manguera" },
  { key: "anilloSeguridad", label: "Anillo de Seguridad" },
  { key: "pinSeguridad", label: "Pin de Seguridad" },
  { key: "pintura", label: "Pintura" },
  { key: "tarjetaInspeccion", label: "Tarjeta de Inspección" },
];

const ESTADO_COLORS = {
  Bueno: "bg-green-500/20 text-green-400 border-green-500/30",
  Regular: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Malo: "bg-red-500/20 text-red-400 border-red-500/30",
  NA: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Faltante: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// ══════════════════════════════════════════════════════════
// Componente Principal
// ══════════════════════════════════════════════════════════
export default function InspeccionesEmergenciaPage() {
  const router = useRouter();
  const { user } = useSession();

  // Estado principal
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoInspeccion | null>(null);
  const [fechaInspeccion, setFechaInspeccion] = useState(formatDate(new Date()));
  const [inspector, setInspector] = useState("");
  const [cargoInspector, setCargoInspector] = useState("");
  const [observacionesGenerales, setObservacionesGenerales] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Catálogos
  const [extintores, setExtintores] = useState<ExtintorItem[]>([]);
  const [botiquines, setBotiquines] = useState<BotiquinItem[]>([]);
  const [camillas, setCamillas] = useState<CamillaItem[]>([]);
  const [kits, setKits] = useState<KitItem[]>([]);
  const [elementos, setElementos] = useState<ElementoItem[]>([]);
  const [responsablesSST, setResponsablesSST] = useState<ResponsableSST[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado de inspección por equipo
  const [inspeccionExtintores, setInspeccionExtintores] = useState<Record<string, CriteriosExtintor>>({});
  const [inspeccionElementos, setInspeccionElementos] = useState<Record<string, Record<string, EstadoElementoInsp>>>({});
  const [verificacionesKit, setVerificacionesKit] = useState<Record<string, VerificacionKit>>({});

  // Responsables de la inspección
  const [responsables, setResponsables] = useState<ResponsableInspeccion[]>([
    { tipo: "Inspector", nombre: "", cedula: "", cargo: "" },
    { tipo: "Responsable SG-SST", nombre: "", cedula: "", cargo: "" },
    { tipo: "COPASST", nombre: "", cedula: "", cargo: "" },
  ]);

  // Equipos seleccionados para inspeccionar
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<string[]>([]);

  // Cargar responsables SST
  const cargarResponsablesSST = useCallback(async () => {
    try {
      const res = await fetch("/api/inspecciones-areas?responsables=true");
      const data = await res.json();
      if (data.success) {
        setResponsablesSST(data.responsables || []);
      }
    } catch (error) {
      console.error("Error cargando responsables SST:", error);
    }
  }, []);

  // Cargar catálogos según tipo seleccionado
  const cargarCatalogos = useCallback(async (tipo: TipoInspeccion) => {
    setLoading(true);
    try {
      switch (tipo) {
        case "Extintor": {
          const res = await fetch("/api/inspecciones-extintor?extintores=true");
          const data = await res.json();
          if (data.success) {
            setExtintores(data.extintores || []);
          }
          break;
        }
        case "Botiquín": {
          const [resBotiquines, resElementos] = await Promise.all([
            fetch("/api/inspecciones-botiquin?botiquines=true"),
            fetch("/api/inspecciones-botiquin?elementos=true"),
          ]);
          const [dataBotiquines, dataElementos] = await Promise.all([
            resBotiquines.json(),
            resElementos.json(),
          ]);
          if (dataBotiquines.success) setBotiquines(dataBotiquines.botiquines || []);
          if (dataElementos.success) setElementos(dataElementos.elementos || []);
          break;
        }
        case "Camilla": {
          const [resCamillas, resElementos] = await Promise.all([
            fetch("/api/inspecciones-camilla?camillas=true"),
            fetch("/api/inspecciones-camilla?elementos=true"),
          ]);
          const [dataCamillas, dataElementos] = await Promise.all([
            resCamillas.json(),
            resElementos.json(),
          ]);
          if (dataCamillas.success) setCamillas(dataCamillas.camillas || []);
          if (dataElementos.success) setElementos(dataElementos.elementos || []);
          break;
        }
        case "Kit Derrames": {
          const [resKits, resElementos] = await Promise.all([
            fetch("/api/inspecciones-kit-derrames?kits=true"),
            fetch("/api/inspecciones-kit-derrames?elementos=true"),
          ]);
          const [dataKits, dataElementos] = await Promise.all([
            resKits.json(),
            resElementos.json(),
          ]);
          if (dataKits.success) setKits(dataKits.kits || []);
          if (dataElementos.success) setElementos(dataElementos.elementos || []);
          break;
        }
      }
    } catch (error) {
      console.error("Error cargando catálogos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarResponsablesSST();
  }, [cargarResponsablesSST]);

  useEffect(() => {
    if (tipoSeleccionado) {
      cargarCatalogos(tipoSeleccionado);
      // Resetear estados
      setEquiposSeleccionados([]);
      setInspeccionExtintores({});
      setInspeccionElementos({});
      setVerificacionesKit({});
    }
  }, [tipoSeleccionado, cargarCatalogos]);

  // Inicializar estados cuando se selecciona un equipo
  const toggleEquipoSeleccionado = (equipoId: string) => {
    setEquiposSeleccionados((prev) => {
      if (prev.includes(equipoId)) {
        return prev.filter((id) => id !== equipoId);
      } else {
        // Inicializar estado para el equipo
        if (tipoSeleccionado === "Extintor") {
          setInspeccionExtintores((prevInsp) => ({
            ...prevInsp,
            [equipoId]: {
              presion: null,
              selloGarantia: null,
              manometro: null,
              estadoCilindro: null,
              manija: null,
              boquillaManguera: null,
              anilloSeguridad: null,
              pinSeguridad: null,
              pintura: null,
              tarjetaInspeccion: null,
              observaciones: "",
            },
          }));
        } else if (tipoSeleccionado === "Kit Derrames") {
          setVerificacionesKit((prevVer) => ({
            ...prevVer,
            [equipoId]: {
              conoceProcedimiento: false,
              almacenamientoAdecuado: false,
              rotuladoSenalizado: false,
            },
          }));
          // Inicializar elementos
          const elementosInit: Record<string, EstadoElementoInsp> = {};
          elementos.forEach((elem) => {
            elementosInit[elem.id] = {
              estadoElemento: null,
              cantidad: elem.cantidadEstandar || 0,
              fechaVencimiento: "",
              observaciones: "",
            };
          });
          setInspeccionElementos((prevInsp) => ({
            ...prevInsp,
            [equipoId]: elementosInit,
          }));
        } else {
          // Botiquín o Camilla
          const elementosInit: Record<string, EstadoElementoInsp> = {};
          elementos.forEach((elem) => {
            elementosInit[elem.id] = {
              estadoElemento: null,
              cantidad: elem.cantidadEstandar || 0,
              fechaVencimiento: "",
              observaciones: "",
            };
          });
          setInspeccionElementos((prevInsp) => ({
            ...prevInsp,
            [equipoId]: elementosInit,
          }));
        }
        return [...prev, equipoId];
      }
    });
  };

  // Guardar inspección
  const guardarInspeccion = async () => {
    if (!tipoSeleccionado || equiposSeleccionados.length === 0) {
      setErrorMessage("Seleccione al menos un equipo para inspeccionar");
      return;
    }

    setPageState("saving");
    setErrorMessage("");

    try {
      let endpoint = "";
      let payload: unknown;

      const responsablesFiltered = responsables.filter((r) => r.nombre.trim() !== "");

      switch (tipoSeleccionado) {
        case "Extintor":
          endpoint = "/api/inspecciones-extintor";
          payload = {
            fechaInspeccion,
            inspector,
            cargoInspector,
            observacionesGenerales,
            detalles: equiposSeleccionados.map((equipoId) => ({
              extintorRecordId: equipoId,
              ...inspeccionExtintores[equipoId],
            })),
            responsables: responsablesFiltered,
          };
          break;

        case "Botiquín":
          endpoint = "/api/inspecciones-botiquin";
          payload = {
            fechaInspeccion,
            inspector,
            cargoInspector,
            observacionesGenerales,
            detalles: equiposSeleccionados.flatMap((equipoId) =>
              Object.entries(inspeccionElementos[equipoId] || {}).map(([elemId, estado]) => ({
                botiquinRecordId: equipoId,
                elementoRecordId: elemId,
                ...estado,
              }))
            ),
            responsables: responsablesFiltered,
          };
          break;

        case "Camilla":
          endpoint = "/api/inspecciones-camilla";
          payload = {
            fechaInspeccion,
            inspector,
            cargoInspector,
            observacionesGenerales,
            detalles: equiposSeleccionados.flatMap((equipoId) =>
              Object.entries(inspeccionElementos[equipoId] || {}).map(([elemId, estado]) => ({
                camillaRecordId: equipoId,
                elementoRecordId: elemId,
                ...estado,
              }))
            ),
            responsables: responsablesFiltered,
          };
          break;

        case "Kit Derrames":
          endpoint = "/api/inspecciones-kit-derrames";
          payload = {
            fechaInspeccion,
            inspector,
            cargoInspector,
            observacionesGenerales,
            detalles: equiposSeleccionados.flatMap((equipoId) =>
              Object.entries(inspeccionElementos[equipoId] || {}).map(([elemId, estado]) => ({
                kitRecordId: equipoId,
                elementoRecordId: elemId,
                ...estado,
              }))
            ),
            verificaciones: equiposSeleccionados.map((equipoId) => ({
              kitRecordId: equipoId,
              ...verificacionesKit[equipoId],
            })),
            responsables: responsablesFiltered,
          };
          break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setPageState("success");
        setTimeout(() => {
          router.push("/dashboard/inspecciones-emergencia/historial");
        }, 2000);
      } else {
        setPageState("error");
        setErrorMessage(data.error || "Error al guardar la inspección");
      }
    } catch (error) {
      console.error("Error guardando inspección:", error);
      setPageState("error");
      setErrorMessage("Error de conexión al guardar");
    }
  };

  // ══════════════════════════════════════════════════════════
  // Render: Selector de Tipo
  // ══════════════════════════════════════════════════════════
  const renderSelectorTipo = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Seleccione el tipo de inspección</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIPOS_INSPECCION.map(({ tipo, icon, color, descripcion }) => (
          <button
            key={tipo}
            onClick={() => setTipoSeleccionado(tipo)}
            className={`p-6 rounded-xl border-2 transition-all duration-200 ${
              tipoSeleccionado === tipo
                ? `${color} scale-105 shadow-lg`
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={tipoSeleccionado === tipo ? "" : "text-gray-400"}>{icon}</div>
              <span className="font-medium text-white">{tipo}</span>
              <span className="text-xs text-gray-400">{descripcion}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // Render: Lista de Equipos
  // ══════════════════════════════════════════════════════════
  const renderListaEquipos = () => {
    if (!tipoSeleccionado) return null;
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <span className="ml-3 text-gray-400">Cargando equipos...</span>
        </div>
      );
    }

    let equipos: { id: string; codigo: string; nombre: string }[] = [];
    switch (tipoSeleccionado) {
      case "Extintor":
        equipos = extintores.map((e) => ({ id: e.id, codigo: e.codigo, nombre: `${e.nombre} (${e.capacidad})` }));
        break;
      case "Botiquín":
        equipos = botiquines;
        break;
      case "Camilla":
        equipos = camillas;
        break;
      case "Kit Derrames":
        equipos = kits;
        break;
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">
          Seleccione los equipos a inspeccionar ({equiposSeleccionados.length} seleccionados)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {equipos.map((equipo) => (
            <button
              key={equipo.id}
              onClick={() => toggleEquipoSeleccionado(equipo.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                equiposSeleccionados.includes(equipo.id)
                  ? "bg-blue-500/20 border-blue-500/50"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    equiposSeleccionados.includes(equipo.id) ? "bg-blue-500 border-blue-500" : "border-gray-500"
                  }`}
                >
                  {equiposSeleccionados.includes(equipo.id) && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <p className="font-medium text-white">{equipo.codigo}</p>
                  <p className="text-sm text-gray-400">{equipo.nombre}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // Render: Formulario por Tipo
  // ══════════════════════════════════════════════════════════
  const renderFormularioExtintor = (equipoId: string) => {
    const extintor = extintores.find((e) => e.id === equipoId);
    const criterios = inspeccionExtintores[equipoId];
    if (!extintor || !criterios) return null;

    return (
      <div key={equipoId} className="bg-white/5 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-white">{extintor.codigo} - {extintor.nombre}</h4>
          <span className="text-sm text-gray-400">{extintor.capacidad}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {CRITERIOS_EXTINTOR_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-gray-400">{label}</label>
              <div className="flex gap-1">
                {(["Bueno", "Regular", "Malo", "NA"] as EstadoCriterio[]).map((estado) => (
                  <button
                    key={estado}
                    onClick={() =>
                      setInspeccionExtintores((prev) => ({
                        ...prev,
                        [equipoId]: {
                          ...prev[equipoId],
                          [key]: criterios[key as keyof CriteriosExtintor] === estado ? null : estado,
                        },
                      }))
                    }
                    className={`px-2 py-1 text-xs rounded border transition-all ${
                      criterios[key as keyof CriteriosExtintor] === estado
                        ? ESTADO_COLORS[estado!]
                        : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                    }`}
                  >
                    {estado === "NA" ? "N/A" : estado?.charAt(0)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <textarea
          placeholder="Observaciones..."
          value={criterios.observaciones}
          onChange={(e) =>
            setInspeccionExtintores((prev) => ({
              ...prev,
              [equipoId]: { ...prev[equipoId], observaciones: e.target.value },
            }))
          }
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none"
          rows={2}
        />
      </div>
    );
  };

  const renderFormularioElementos = (equipoId: string, tipoEquipo: string) => {
    const elementosEquipo = inspeccionElementos[equipoId];
    if (!elementosEquipo) return null;

    const getEquipoNombre = () => {
      switch (tipoSeleccionado) {
        case "Botiquín":
          return botiquines.find((b) => b.id === equipoId)?.nombre || equipoId;
        case "Camilla":
          return camillas.find((c) => c.id === equipoId)?.nombre || equipoId;
        case "Kit Derrames":
          return kits.find((k) => k.id === equipoId)?.nombre || equipoId;
        default:
          return equipoId;
      }
    };

    return (
      <div key={equipoId} className="bg-white/5 rounded-xl p-4 space-y-4">
        <h4 className="font-medium text-white">{getEquipoNombre()}</h4>
        
        {/* Verificaciones para Kit Derrames */}
        {tipoSeleccionado === "Kit Derrames" && verificacionesKit[equipoId] && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-3">
            <h5 className="text-sm font-medium text-yellow-400">Verificaciones</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: "conoceProcedimiento", label: "¿El responsable conoce el procedimiento?" },
                { key: "almacenamientoAdecuado", label: "¿Almacenamiento adecuado?" },
                { key: "rotuladoSenalizado", label: "¿Está rotulado y señalizado?" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verificacionesKit[equipoId][key as keyof VerificacionKit]}
                    onChange={(e) =>
                      setVerificacionesKit((prev) => ({
                        ...prev,
                        [equipoId]: { ...prev[equipoId], [key]: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-600 bg-white/5"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Elementos */}
        <div className="space-y-2">
          {elementos.map((elem) => {
            const estado = elementosEquipo[elem.id];
            if (!estado) return null;

            return (
              <div key={elem.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-white/5">
                <div className="col-span-4 md:col-span-3">
                  <span className="text-sm text-white">{elem.nombre}</span>
                  {elem.unidad && <span className="text-xs text-gray-500 ml-1">({elem.unidad})</span>}
                </div>
                <div className="col-span-4 md:col-span-3 flex gap-1">
                  {(["Bueno", "Regular", "Malo", "Faltante"] as EstadoElemento[]).map((est) => (
                    <button
                      key={est}
                      onClick={() =>
                        setInspeccionElementos((prev) => ({
                          ...prev,
                          [equipoId]: {
                            ...prev[equipoId],
                            [elem.id]: { ...prev[equipoId][elem.id], estadoElemento: estado.estadoElemento === est ? null : est },
                          },
                        }))
                      }
                      className={`px-2 py-1 text-xs rounded border transition-all ${
                        estado.estadoElemento === est
                          ? ESTADO_COLORS[est!]
                          : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                      }`}
                    >
                      {est?.charAt(0)}
                    </button>
                  ))}
                </div>
                <div className="col-span-2 md:col-span-2">
                  <input
                    type="number"
                    min={0}
                    value={estado.cantidad}
                    onChange={(e) =>
                      setInspeccionElementos((prev) => ({
                        ...prev,
                        [equipoId]: {
                          ...prev[equipoId],
                          [elem.id]: { ...prev[equipoId][elem.id], cantidad: parseInt(e.target.value) || 0 },
                        },
                      }))
                    }
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-center"
                    placeholder="Cant."
                  />
                </div>
                {elem.requiereVencimiento && (
                  <div className="col-span-2 md:col-span-2">
                    <input
                      type="date"
                      value={estado.fechaVencimiento || ""}
                      onChange={(e) =>
                        setInspeccionElementos((prev) => ({
                          ...prev,
                          [equipoId]: {
                            ...prev[equipoId],
                            [elem.id]: { ...prev[equipoId][elem.id], fechaVencimiento: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // Render: Responsables
  // ══════════════════════════════════════════════════════════
  const renderResponsables = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Responsables de la Inspección</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {responsables.map((resp, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-4 space-y-3">
            <label className="text-sm font-medium text-gray-300">{resp.tipo}</label>
            <select
              value={resp.nombre}
              onChange={(e) => {
                const selected = responsablesSST.find((r) => r.nombre === e.target.value);
                setResponsables((prev) =>
                  prev.map((r, i) =>
                    i === idx
                      ? {
                          ...r,
                          nombre: selected?.nombre || "",
                          cedula: selected?.cedula || "",
                          cargo: selected?.cargo || "",
                        }
                      : r
                  )
                );
              }}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="">Seleccionar...</option>
              {responsablesSST
                .filter((r) => !responsables.some((resp, i) => i !== idx && resp.nombre === r.nombre))
                .map((r) => (
                  <option key={r.id} value={r.nombre}>
                    {r.nombre}
                  </option>
                ))}
            </select>
            {resp.cargo && <p className="text-xs text-gray-400">{resp.cargo}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // Render Principal
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => (tipoSeleccionado ? setTipoSeleccionado(null) : router.push("/dashboard"))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Inspecciones de Emergencia</h1>
              <p className="text-gray-400 text-sm">
                {tipoSeleccionado ? `Inspección de ${tipoSeleccionado}` : "Seleccione un tipo de inspección"}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/inspecciones-emergencia/historial")}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            <span className="hidden md:inline">Historial</span>
          </button>
        </div>

        {/* Estado de guardado */}
        {pageState === "saving" && (
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-blue-300">Guardando inspección...</span>
          </div>
        )}
        {pageState === "success" && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-300">Inspección guardada exitosamente. Redirigiendo...</span>
          </div>
        )}
        {pageState === "error" && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{errorMessage}</span>
          </div>
        )}

        {/* Contenido Principal */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-8">
          {/* Selector de tipo */}
          {renderSelectorTipo()}

          {/* Información general */}
          {tipoSeleccionado && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Fecha de Inspección</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={fechaInspeccion}
                    onChange={(e) => setFechaInspeccion(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Inspector</label>
                <input
                  type="text"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  placeholder="Nombre del inspector"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cargo</label>
                <input
                  type="text"
                  value={cargoInspector}
                  onChange={(e) => setCargoInspector(e.target.value)}
                  placeholder="Cargo del inspector"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>
          )}

          {/* Lista de equipos */}
          {renderListaEquipos()}

          {/* Formularios por equipo */}
          {equiposSeleccionados.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Detalles de la Inspección</h3>
              {tipoSeleccionado === "Extintor"
                ? equiposSeleccionados.map((id) => renderFormularioExtintor(id))
                : equiposSeleccionados.map((id) => renderFormularioElementos(id, tipoSeleccionado || ""))}
            </div>
          )}

          {/* Observaciones generales */}
          {equiposSeleccionados.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Observaciones Generales</label>
              <textarea
                value={observacionesGenerales}
                onChange={(e) => setObservacionesGenerales(e.target.value)}
                placeholder="Observaciones generales de la inspección..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white resize-none"
                rows={3}
              />
            </div>
          )}

          {/* Responsables */}
          {equiposSeleccionados.length > 0 && renderResponsables()}

          {/* Botón guardar */}
          {equiposSeleccionados.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={guardarInspeccion}
                disabled={pageState === "saving"}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                {pageState === "saving" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Guardar Inspección
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
