"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "@/presentation/context/SessionContext";

// ══════════════════════════════════════════════════════════
// Dashboard SG-SST organizado bajo el ciclo PHVA
// Decreto 1072/2015 — Resolución 0312/2019 (Estándares Mínimos)
// P: Planear  |  H: Hacer  |  V: Verificar  |  A: Actuar
// ══════════════════════════════════════════════════════════

type ModuleStatus = "active" | "soon";
type Phase = "P" | "H" | "V" | "A";

type Module = {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  href: string;
  status: ModuleStatus;
  /** Estándar Resolución 0312/2019 al que aporta */
  estandar?: string;
};

// ─── Iconos compartidos ──────────────────────────────────
const I = {
  shield: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  ),
  warning: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  calendar: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  academic: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.562 50.562 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>
  ),
  fire: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
    </svg>
  ),
  users: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  document: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
    </svg>
  ),
  presentation: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
  helmet: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </svg>
  ),
  heart: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
  stetoscope: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  alert: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152-6.135c-.022-.564-.098-1.123-.227-1.672C18.062 3.58 15.238 1.5 12 1.5S5.938 3.58 5.172 6.383a7.11 7.11 0 0 0-.227 1.672 23.91 23.91 0 0 1-1.152 6.135A23.863 23.863 0 0 1 12 12.75Z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
  ),
  chart: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  search: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  scale: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97Z" />
    </svg>
  ),
  refresh: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  wrench: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
    </svg>
  ),
};

// ─── Configuración de fases PHVA ─────────────────────────
const phases: Record<Phase, { letter: string; name: string; description: string; accent: string; ring: string; badge: string }> = {
  P: {
    letter: "P",
    name: "Planear",
    description: "Política, identificación de peligros, planeación estratégica del SG-SST.",
    accent: "from-blue-500/30 to-blue-500/5",
    ring: "ring-blue-400/40",
    badge: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  },
  H: {
    letter: "H",
    name: "Hacer",
    description: "Implementación operativa: capacitación, EPP, inspecciones, salud y emergencias.",
    accent: "from-emerald-500/30 to-emerald-500/5",
    ring: "ring-emerald-400/40",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  V: {
    letter: "V",
    name: "Verificar",
    description: "Indicadores, auditorías y revisión por la alta dirección.",
    accent: "from-amber-500/30 to-amber-500/5",
    ring: "ring-amber-400/40",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  },
  A: {
    letter: "A",
    name: "Actuar",
    description: "Acciones correctivas, preventivas y mejora continua.",
    accent: "from-purple-500/30 to-purple-500/5",
    ring: "ring-purple-400/40",
    badge: "bg-purple-500/20 text-purple-200 border-purple-400/30",
  },
};

// ─── Módulos por fase PHVA ───────────────────────────────
const modulesByPhase: Record<Phase, Module[]> = {
  // ════════════════════ P · PLANEAR ════════════════════
  P: [
    {
      title: "Política y Objetivos SST",
      description: "Política de SST firmada, objetivos medibles y alcance del sistema.",
      icon: I.scale,
      color: "bg-blue-500/15 text-blue-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 2.1.1 / 2.2.1",
    },
    {
      title: "Matriz de Peligros y Riesgos",
      description: "Identificación, valoración y control de riesgos laborales (GTC 45).",
      icon: I.warning,
      color: "bg-orange-500/15 text-orange-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 4.1.1",
    },
    {
      title: "Plan Anual SG-SST",
      description: "Cronograma PHVA de actividades del Sistema de Gestión SST.",
      icon: I.calendar,
      color: "bg-indigo-500/15 text-indigo-300",
      href: "/dashboard/plan-anual",
      status: "active",
      estandar: "Estándar 2.5.1",
    },
    {
      title: "Plan de Capacitaciones",
      description: "Programación anual de capacitación, inducción y reinducción SST.",
      icon: I.academic,
      color: "bg-sky-500/15 text-sky-300",
      href: "/dashboard/plan-anual",
      status: "active",
      estandar: "Estándar 2.7.1 / 2.8.1",
    },
    {
      title: "Plan de Emergencias",
      description: "Plan de prevención, preparación y respuesta ante emergencias.",
      icon: I.fire,
      color: "bg-red-500/15 text-red-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 5.1.1 / 5.1.2",
    },
    {
      title: "Comités SST",
      description: "Actas digitales COPASST y COCOLAB con firma electrónica.",
      icon: I.users,
      color: "bg-amber-500/15 text-amber-300",
      href: "/dashboard/comites",
      status: "active",
      estandar: "Estándar 1.1.6 / 1.1.8",
    },
  ],
  // ════════════════════ H · HACER ══════════════════════
  H: [
    {
      title: "Registros de Asistencia",
      description: "Asistencia con firma a charlas, capacitaciones y actividades SST.",
      icon: I.presentation,
      color: "bg-purple-500/15 text-purple-300",
      href: "/dashboard/registros-asistencia",
      status: "active",
      estandar: "Estándar 2.7.1",
    },
    {
      title: "Inventario de EPP",
      description: "Catálogo, stock y entrega de elementos de protección personal con firma.",
      icon: I.helmet,
      color: "bg-teal-500/15 text-teal-300",
      href: "/dashboard/inventario-epp",
      status: "active",
      estandar: "Estándar 6.1.4",
    },
    {
      title: "Inspecciones",
      description: "Inspecciones de EPP, áreas, equipos de emergencia, botiquines y extintores.",
      icon: I.clipboard,
      color: "bg-emerald-500/15 text-emerald-300",
      href: "/dashboard/inspecciones",
      status: "active",
      estandar: "Estándar 4.2.5",
    },
    {
      title: "Exámenes Médicos",
      description: "Exámenes médicos ocupacionales: ingreso, periódicos y de retiro.",
      icon: I.stetoscope,
      color: "bg-cyan-500/15 text-cyan-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 3.1.6",
    },
    {
      title: "PVE Osteomuscular",
      description: "Programa de Vigilancia Epidemiológica osteomuscular.",
      icon: I.heart,
      color: "bg-rose-500/15 text-rose-300",
      href: "/dashboard/pve",
      status: "active",
      estandar: "Estándar 3.1.7",
    },
    {
      title: "Incidentes y Accidentes",
      description: "Reporte, investigación y análisis de causas de eventos laborales.",
      icon: I.alert,
      color: "bg-red-500/15 text-red-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 3.1.8 / 7.1.1",
    },
    {
      title: "Gestión de Contratistas",
      description: "Afiliación ARL, evaluación SST y control de contratistas y proveedores.",
      icon: I.briefcase,
      color: "bg-yellow-500/15 text-yellow-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 1.2.3",
    },
  ],
  // ════════════════════ V · VERIFICAR ══════════════════
  V: [
    {
      title: "Indicadores SG-SST",
      description: "Indicadores de estructura, proceso y resultado del SG-SST.",
      icon: I.chart,
      color: "bg-amber-500/15 text-amber-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 4.1.4 / 4.2.1",
    },
    {
      title: "Auditoría Interna",
      description: "Programa anual de auditorías internas al SG-SST.",
      icon: I.search,
      color: "bg-orange-500/15 text-orange-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 6.1.1",
    },
    {
      title: "Revisión por la Alta Dirección",
      description: "Revisión anual de resultados y desempeño del sistema.",
      icon: I.scale,
      color: "bg-yellow-500/15 text-yellow-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 6.1.2",
    },
  ],
  // ════════════════════ A · ACTUAR ═════════════════════
  A: [
    {
      title: "Acciones Correctivas y Preventivas",
      description: "Plan de acción ante hallazgos, no conformidades y oportunidades.",
      icon: I.wrench,
      color: "bg-purple-500/15 text-purple-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 7.1.2 / 7.1.3",
    },
    {
      title: "Documentación SG-SST",
      description: "Gestión documental, control de versiones y conservación de registros.",
      icon: I.document,
      color: "bg-fuchsia-500/15 text-fuchsia-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 2.11.1",
    },
    {
      title: "Mejora Continua",
      description: "Seguimiento de oportunidades de mejora y resultados de la revisión.",
      icon: I.refresh,
      color: "bg-violet-500/15 text-violet-300",
      href: "#",
      status: "soon",
      estandar: "Estándar 7.1.4",
    },
  ],
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useSession();
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleOpen = (mod: Module) => {
    if (mod.status === "active" && mod.href !== "#") router.push(mod.href);
  };

  // Conteo total de módulos activos
  const allModules = Object.values(modulesByPhase).flat();
  const totalActive = allModules.filter((m) => m.status === "active").length;
  const totalSoon = allModules.filter((m) => m.status === "soon").length;

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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white" style={{ textShadow: "0 2px 15px rgba(0,0,0,0.4)" }}>
            {user ? `Hola, ${user.nombreCompleto.split(" ")[0]}` : "Bienvenido al SG-SST"}
          </h2>
          <p className="mt-2 text-white/60 text-lg">
            Sistema organizado bajo el ciclo PHVA — Decreto 1072/2015 y Resolución 0312/2019.
          </p>
        </div>

        {/* PHVA Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {(Object.keys(phases) as Phase[]).map((p) => {
            const ph = phases[p];
            const count = modulesByPhase[p].filter((m) => m.status === "active").length;
            const total = modulesByPhase[p].length;
            return (
              <a
                key={p}
                href={`#fase-${p}`}
                className={`relative overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br ${ph.accent} p-4 hover:border-white/30 transition-all group`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-2xl text-white ring-2 ${ph.ring} bg-white/10`}>
                    {ph.letter}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{ph.name}</p>
                    <p className="text-xs text-white/60">{count}/{total} activos</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Módulos activos", value: String(totalActive), color: "text-emerald-300" },
            { label: "Por implementar", value: String(totalSoon), color: "text-amber-300" },
            { label: "Estándares cubiertos", value: `${totalActive}/62`, color: "text-sky-300" },
            { label: "Fases PHVA", value: "4/4", color: "text-purple-300" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-4">
              <p className="text-xs text-white/50">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* PHVA Sections */}
        <div className="space-y-12">
          {(Object.keys(phases) as Phase[]).map((p) => {
            const ph = phases[p];
            const mods = modulesByPhase[p];
            return (
              <section key={p} id={`fase-${p}`} className="scroll-mt-24">
                {/* Phase header */}
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${ph.accent} border border-white/15 p-6 mb-5`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-4xl text-white ring-2 ${ph.ring} bg-white/10 backdrop-blur shadow-lg`}>
                      {ph.letter}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-white">{ph.name}</h3>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ph.badge}`}>
                          {mods.length} módulos
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/70">{ph.description}</p>
                    </div>
                  </div>
                </div>

                {/* Modules grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mods.map((mod) => {
                    const isActive = mod.status === "active";
                    return (
                      <button
                        key={mod.title}
                        onClick={() => handleOpen(mod)}
                        disabled={!isActive}
                        className={`relative bg-white/10 backdrop-blur-xl rounded-xl border p-5 text-left transition-all group ${
                          isActive
                            ? "border-white/15 hover:bg-white/20 hover:border-white/30 hover:shadow-2xl hover:shadow-black/20 cursor-pointer"
                            : "border-white/10 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {/* Status badge */}
                        <div className="absolute top-3 right-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Activo
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/15">
                              Próximamente
                            </span>
                          )}
                        </div>

                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${mod.color} mb-3`}>
                          {mod.icon}
                        </div>
                        <h4 className="font-semibold text-white pr-16 leading-tight">{mod.title}</h4>
                        <p className="text-sm text-white/50 mt-1.5 leading-snug">{mod.description}</p>

                        {mod.estandar && (
                          <p className="mt-3 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                            {mod.estandar}
                          </p>
                        )}

                        {isActive && (
                          <div className="mt-3 flex items-center text-xs text-sirius-cielo font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Abrir módulo
                            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center text-xs text-white/40">
          Sirius SG-SST · Estructura conforme al Decreto 1072 de 2015 y Resolución 0312 de 2019
        </div>
      </main>
    </div>
  );
}

