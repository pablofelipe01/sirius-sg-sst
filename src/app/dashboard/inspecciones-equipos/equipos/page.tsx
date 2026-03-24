"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Flame,
  MapPin,
  Package,
  Save,
  RotateCcw,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface EquipoItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  tipoEspecifico: string;
  area: string;
  ubicacion: string;
  capacidad: string;
  fechaVencimiento: string | null;
  estado: string;
  descripcion: string;
}

type ModalMode = "create" | "edit" | null;

// ══════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════
const CATEGORIAS = ["Extintor", "Botiquín", "Camilla", "Kit Derrames"] as const;
const AREAS = ["Laboratorio", "Pirólisis", "Bodega"] as const;

const TIPOS_POR_CATEGORIA: Record<string, string[]> = {
  Extintor: ["Polvo Químico Seco (PQS)", "CO2", "Agua presurizada", "Espuma", "Clase K"],
  Botiquín: ["Tipo A", "Tipo B", "Tipo C"],
  Camilla: ["Rígida", "Plegable", "Tipo Miller"],
  "Kit Derrames": ["Químico", "Aceites", "Combustibles", "Universal"],
};

const CATEGORIA_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  Extintor:        { color: "text-red-400",    bgColor: "bg-red-500/20",    borderColor: "border-red-500/30",    icon: "🧯" },
  Botiquín:        { color: "text-green-400",  bgColor: "bg-green-500/20",  borderColor: "border-green-500/30",  icon: "🩹" },
  Camilla:         { color: "text-blue-400",   bgColor: "bg-blue-500/20",   borderColor: "border-blue-500/30",   icon: "🛏️" },
  "Kit Derrames":  { color: "text-yellow-400", bgColor: "bg-yellow-500/20", borderColor: "border-yellow-500/30", icon: "⚠️" },
};

// ══════════════════════════════════════════════════════════
// Componente Modal de Equipo
// ══════════════════════════════════════════════════════════
function EquipoModal({
  mode,
  equipo,
  onClose,
  onSave,
  saving,
}: {
  mode: ModalMode;
  equipo: Partial<EquipoItem> | null;
  onClose: () => void;
  onSave: (data: Partial<EquipoItem>) => Promise<void>;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<EquipoItem>>({
    codigo: "",
    nombre: "",
    categoria: "Extintor",
    tipoEspecifico: "",
    area: "Laboratorio",
    ubicacion: "",
    capacidad: "",
    fechaVencimiento: "",
    descripcion: "",
    ...equipo,
  });

  const handleChange = (field: keyof EquipoItem, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Si cambia categoría, resetear tipo específico
      if (field === "categoria") {
        updated.tipoEspecifico = "";
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const tiposDisponibles = TIPOS_POR_CATEGORIA[formData.categoria || "Extintor"] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              {mode === "create" ? <Plus className="w-5 h-5 text-red-400" /> : <Pencil className="w-5 h-5 text-red-400" />}
            </div>
            <h2 className="text-lg font-semibold text-white">
              {mode === "create" ? "Nuevo Equipo de Emergencia" : "Editar Equipo"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Código <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => handleChange("codigo", e.target.value)}
                placeholder="EXT-001"
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Categoría <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => handleChange("categoria", e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-800">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              placeholder="Extintor PQS 20lb - Entrada Principal"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo Específico */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Tipo Específico</label>
              <select
                value={formData.tipoEspecifico}
                onChange={(e) => handleChange("tipoEspecifico", e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">Seleccionar...</option>
                {tiposDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo} className="bg-slate-800">
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            {/* Área */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Área <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.area}
                onChange={(e) => handleChange("area", e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
              >
                {AREAS.map((area) => (
                  <option key={area} value={area} className="bg-slate-800">
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ubicación Detallada */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Ubicación Detallada</label>
              <input
                type="text"
                value={formData.ubicacion}
                onChange={(e) => handleChange("ubicacion", e.target.value)}
                placeholder="Entrada principal, junto a tablero"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
            </div>

            {/* Capacidad */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Capacidad</label>
              <input
                type="text"
                value={formData.capacidad}
                onChange={(e) => handleChange("capacidad", e.target.value)}
                placeholder="20 lb, 10 kg, 1 persona"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50"
              />
            </div>
          </div>

          {/* Fecha Vencimiento */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Fecha de Vencimiento</label>
            <input
              type="date"
              value={formData.fechaVencimiento || ""}
              onChange={(e) => handleChange("fechaVencimiento", e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-red-400/50"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => handleChange("descripcion", e.target.value)}
              placeholder="Notas adicionales sobre el equipo..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {mode === "create" ? "Crear Equipo" : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════
export default function AdministrarEquiposPage() {
  const router = useRouter();

  // Estados principales
  const [equipos, setEquipos] = useState<EquipoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("Todas");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EquipoItem | null>(null);

  // Cargar equipos
  const fetchEquipos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipos-emergencia");
      const json = await res.json();
      if (json.success && json.data) {
        setEquipos(json.data);
        // Expandir todas las áreas por defecto
        const areas = [...new Set(json.data.map((e: EquipoItem) => e.area))];
        const expanded: Record<string, boolean> = {};
        areas.forEach((a) => (expanded[a as string] = true));
        setExpandedAreas(expanded);
      }
    } catch {
      setMessage({ type: "error", text: "Error al cargar los equipos" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipos();
  }, [fetchEquipos]);

  // Filtrar equipos
  const equiposFiltrados = equipos.filter((e) => {
    const matchSearch =
      searchQuery === "" ||
      e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.ubicacion.toLowerCase().includes(searchQuery.toLowerCase());

    const matchArea = areaFilter === "Todas" || e.area === areaFilter;
    const matchCategoria = categoriaFilter === "Todas" || e.categoria === categoriaFilter;

    return matchSearch && matchArea && matchCategoria;
  });

  // Agrupar por área
  const equiposPorArea = equiposFiltrados.reduce(
    (acc, eq) => {
      const area = eq.area || "Sin Área";
      if (!acc[area]) acc[area] = [];
      acc[area].push(eq);
      return acc;
    },
    {} as Record<string, EquipoItem[]>
  );

  const areas = [...new Set(equipos.map((e) => e.area))].filter(Boolean).sort();

  // Toggle área
  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  // CRUD Operations
  const handleCreate = () => {
    setSelectedEquipo(null);
    setModalMode("create");
  };

  const handleEdit = (equipo: EquipoItem) => {
    setSelectedEquipo(equipo);
    setModalMode("edit");
  };

  const handleDelete = async (equipo: EquipoItem) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/equipos-emergencia?id=${equipo.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: `${equipo.nombre} eliminado exitosamente` });
        fetchEquipos();
      } else {
        setMessage({ type: "error", text: json.message || "Error al eliminar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error al eliminar el equipo" });
    } finally {
      setSaving(false);
      setDeleteConfirm(null);
    }
  };

  const handleSave = async (data: Partial<EquipoItem>) => {
    setSaving(true);
    try {
      const isEdit = modalMode === "edit" && selectedEquipo;
      const res = await fetch("/api/equipos-emergencia", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { ...data, id: selectedEquipo.id } : data),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: "success",
          text: isEdit ? "Equipo actualizado exitosamente" : "Equipo creado exitosamente",
        });
        setModalMode(null);
        setSelectedEquipo(null);
        fetchEquipos();
      } else {
        setMessage({ type: "error", text: json.message || "Error al guardar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error al guardar el equipo" });
    } finally {
      setSaving(false);
    }
  };

  // Estadísticas
  const stats = {
    total: equipos.length,
    porCategoria: CATEGORIAS.reduce((acc, cat) => {
      acc[cat] = equipos.filter((e) => e.categoria === cat).length;
      return acc;
    }, {} as Record<string, number>),
  };

  // ══════════════════════════════════════════════════════════
  // Renderizado
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      {/* Background */}
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inspecciones-equipos")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/20 backdrop-blur-sm">
                  <Package className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Administrar Equipos</h1>
                  <p className="text-xs text-white/60">Gestión de equipos de emergencia</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchEquipos}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <RotateCcw size={18} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Nuevo Equipo</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mensaje */}
        {message && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              message.type === "success"
                ? "bg-green-500/20 border-green-500/30 text-white"
                : "bg-red-500/20 border-red-500/30 text-white"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <p className="text-sm">{message.text}</p>
            <button onClick={() => setMessage(null)} className="ml-auto p-1 hover:bg-white/10 rounded">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 p-4">
            <p className="text-xs text-white/60">Total Equipos</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          {CATEGORIAS.map((cat) => {
            const config = CATEGORIA_CONFIG[cat];
            return (
              <div
                key={cat}
                className={`${config.bgColor} backdrop-blur-xl rounded-xl border ${config.borderColor} p-4`}
              >
                <p className="text-xs text-white/60 flex items-center gap-1">
                  <span>{config.icon}</span> {cat}
                </p>
                <p className={`text-2xl font-bold ${config.color}`}>{stats.porCategoria[cat]}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, código o ubicación..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-400/50 text-sm"
              />
            </div>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
            >
              <option value="Todas" className="bg-slate-800">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a} className="bg-slate-800">{a}</option>
              ))}
            </select>
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 appearance-none cursor-pointer"
            >
              <option value="Todas" className="bg-slate-800">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} className="bg-slate-800">{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Equipos por Área */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
        ) : Object.keys(equiposPorArea).length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <Flame className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No se encontraron equipos</p>
            <button
              onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <Plus size={18} />
              Agregar primer equipo
            </button>
          </div>
        ) : (
          Object.entries(equiposPorArea)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([area, equiposArea]) => (
              <div
                key={area}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
              >
                {/* Header de Área */}
                <button
                  onClick={() => toggleArea(area)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10">
                      <MapPin className="w-5 h-5 text-white/80" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-semibold text-white">{area}</h3>
                      <p className="text-xs text-white/50">
                        {equiposArea.length} equipo{equiposArea.length !== 1 ? "s" : ""}
                        {" · "}
                        {[...new Set(equiposArea.map((e) => e.categoria))].join(", ")}
                      </p>
                    </div>
                  </div>
                  {expandedAreas[area] ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  )}
                </button>

                {/* Lista de Equipos */}
                {expandedAreas[area] && (
                  <div className="border-t border-white/10">
                    {equiposArea.map((equipo, idx) => {
                      const catConfig = CATEGORIA_CONFIG[equipo.categoria] || CATEGORIA_CONFIG.Extintor;
                      return (
                        <div
                          key={equipo.id}
                          className={`flex items-center gap-4 p-4 ${idx > 0 ? "border-t border-white/5" : ""} hover:bg-white/[0.03] transition-colors`}
                        >
                          <span className="text-2xl">{catConfig.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-white">{equipo.nombre}</p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${catConfig.bgColor} ${catConfig.color} ${catConfig.borderColor} border`}
                              >
                                {equipo.categoria}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50 mt-1">
                              <span>Código: {equipo.codigo}</span>
                              {equipo.tipoEspecifico && <span>Tipo: {equipo.tipoEspecifico}</span>}
                              {equipo.ubicacion && <span>📍 {equipo.ubicacion}</span>}
                              {equipo.capacidad && <span>📏 {equipo.capacidad}</span>}
                              {equipo.fechaVencimiento && (
                                <span>📅 Vence: {new Date(equipo.fechaVencimiento).toLocaleDateString("es-CO")}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(equipo)}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(equipo)}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
        )}
      </main>

      {/* Modal de Crear/Editar */}
      {modalMode && (
        <EquipoModal
          mode={modalMode}
          equipo={selectedEquipo}
          onClose={() => {
            setModalMode(null);
            setSelectedEquipo(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Confirmación de Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar equipo?</h3>
              <p className="text-white/60 text-sm mb-6">
                ¿Estás seguro de eliminar <strong className="text-white">{deleteConfirm.nombre}</strong>?
                <br />Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
