"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "@/presentation/context/SessionContext";

const modules = [
  {
    title: "Gestión de Riesgos",
    description: "Identificación, valoración y control de riesgos laborales.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    color: "bg-orange-50 text-orange-600",
    hoverColor: "group-hover:text-orange-600",
    href: "#",
  },
  {
    title: "Plan de Capacitaciones",
    description: "Programación y seguimiento de capacitaciones SST.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.562 50.562 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    color: "bg-sirius-cotiledon/40 text-sirius-azul",
    hoverColor: "group-hover:text-sirius-azul",
    href: "#",
  },
  {
    title: "Inspecciones",
    description: "Inspecciones de EPPs, áreas y equipos de emergencia.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
    color: "bg-sirius-retono text-sirius-verde",
    hoverColor: "group-hover:text-sirius-verde",
    href: "/dashboard/inspecciones",
  },
  {
    title: "Incidentes y Accidentes",
    description: "Reporte e investigación de incidentes laborales.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152-6.135c-.022-.564-.098-1.123-.227-1.672C18.062 3.58 15.238 1.5 12 1.5S5.938 3.58 5.172 6.383a7.11 7.11 0 0 0-.227 1.672 23.91 23.91 0 0 1-1.152 6.135A23.863 23.863 0 0 1 12 12.75Z" />
      </svg>
    ),
    color: "bg-red-50 text-red-500",
    hoverColor: "group-hover:text-red-500",
    href: "#",
  },
  {
    title: "Exámenes Médicos",
    description: "Control de exámenes médicos ocupacionales.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
    color: "bg-sirius-sutileza text-sirius-cielo",
    hoverColor: "group-hover:text-sirius-cielo",
    href: "#",
  },
  {
    title: "Documentación SST",
    description: "Gestión documental del sistema de seguridad y salud.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    color: "bg-sirius-verde-fondo text-sirius-verde-claro",
    hoverColor: "group-hover:text-sirius-verde",
    href: "#",
  },
  {
    title: "Registro de Asistencias",
    description: "Control de asistencia a charlas, capacitaciones y actividades SST.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    color: "bg-purple-50 text-purple-600",
    hoverColor: "group-hover:text-purple-600",
    href: "/dashboard/registros-asistencia",
  },
  {
    title: "Inventario de EPPs",
    description: "Catálogo y control de stock de elementos de protección personal.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
    color: "bg-teal-50 text-teal-600",
    hoverColor: "group-hover:text-teal-600",
    href: "/dashboard/inventario-epp",
  },
  {
    title: "Plan Anual SST 2026",
    description: "Cronograma PHVA de actividades del Sistema de Gestión SST.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
      </svg>
    ),
    color: "bg-indigo-50 text-indigo-600",
    hoverColor: "group-hover:text-indigo-600",
    href: "/dashboard/plan-anual",
  },
  {
    title: "PVE Osteomuscular",
    description: "Programa de Vigilancia Epidemiológica Osteomuscular 2025.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
    color: "bg-cyan-50 text-cyan-600",
    hoverColor: "group-hover:text-cyan-600",
    href: "/dashboard/pve",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useSession();
  const handleLogout = () => {
    logout();
    router.push("/login");
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
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="Sirius" width={240} height={64} className="h-16 w-auto" priority />
              <div className="hidden sm:block h-8 w-px bg-white/20" />
              <p className="hidden sm:block text-sm font-semibold text-white/70 tracking-wide uppercase">SG-SST</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-300 transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white" style={{ textShadow: '0 2px 15px rgba(0,0,0,0.4)' }}>
            {user ? `Hola, ${user.nombreCompleto.split(" ")[0]}` : "Bienvenido al SG-SST"}
          </h2>
          <p className="mt-2 text-white/60 text-lg">
            Selecciona un módulo para comenzar.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Capacitaciones pendientes", value: "—", color: "text-sirius-cielo" },
            { label: "Inspecciones este mes", value: "—", color: "text-sirius-verde" },
            { label: "Incidentes abiertos", value: "—", color: "text-orange-400" },
            { label: "Exámenes por vencer", value: "—", color: "text-sirius-cielo" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-5">
              <p className="text-sm text-white/50">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Modules grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => (
            <button
              key={mod.title}
              onClick={() => { if (mod.href !== "#") router.push(mod.href); }}
              className="relative bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-6 text-left hover:bg-white/20 hover:border-white/30 hover:shadow-2xl hover:shadow-black/20 transition-all group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${mod.color} mb-4`}>
                {mod.icon}
              </div>
              <h3 className="font-semibold text-white group-hover:text-sirius-cielo transition-colors">
                {mod.title}
              </h3>
              <p className="text-sm text-white/50 mt-1">{mod.description}</p>
              <div className="mt-4 flex items-center text-sm text-sirius-cielo font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Abrir módulo
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
