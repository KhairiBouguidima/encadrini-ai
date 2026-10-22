/**
 * Shared sidebar navigation items — single source of truth per role.
 * Import from here in every page that uses AppShell.
 */
import {
  IconStats,
  IconReport,
  IconSparkles,
  IconBell,
  IconUser,
  IconCalendar,
  IconAward,
  IconShield,
  IconStudent,
} from "../components/ui/Icons"
import type { NavItem } from "../components/layout/AppShell"

// ── Étudiant ────────────────────────────────────────────────────────
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { key: "dashboard",   label: "Tableau de bord",        icon: <IconStats     size={18} /> },
  { key: "reports",     label: "Rapports PFE",            icon: <IconReport    size={18} /> },
  { key: "meetings",    label: "Journal & Réunions",      icon: <IconCalendar  size={18} /> },
  { key: "certificate", label: "Certificat de Dépôt",     icon: <IconAward     size={18} /> },
  { key: "compliance",  label: "Conformité",              icon: <IconShield    size={18} /> },
  { key: "workshop",    label: "Atelier IA",              icon: <IconSparkles  size={18} /> },
  { key: "mock-defense",label: "Soutenance IA",           icon: <IconAward     size={18} /> },
  { key: "notifications",label: "Notifications",          icon: <IconBell      size={18} /> },
  { key: "profile",     label: "Mon Profil & Encadreurs", icon: <IconUser      size={18} /> },
]

// ── Encadreur ───────────────────────────────────────────────────────
export const ENCADRER_NAV_ITEMS: NavItem[] = [
  { key: "reports",     label: "Projets & Rapports",      icon: <IconReport    size={18} /> },
  { key: "meetings",    label: "Journal de Réunions",     icon: <IconCalendar  size={18} /> },
  { key: "certificate", label: "Certificat de Dépôt",     icon: <IconAward     size={18} /> },
  { key: "compliance",  label: "Conformité",              icon: <IconShield    size={18} /> },
  { key: "workshop",    label: "Atelier IA",              icon: <IconSparkles  size={18} /> },
  { key: "notifications",label: "Notifications",          icon: <IconBell      size={18} /> },
  { key: "profile",     label: "Mon Profil",              icon: <IconUser      size={18} /> },
]

// ── Admin ────────────────────────────────────────────────────────────
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: "overview",     label: "Vue d'ensemble",         icon: <IconStats     size={18} /> },
  { key: "users",        label: "Gestion des comptes",    icon: <IconStudent   size={18} /> },
  { key: "projects",     label: "Projets PFE",            icon: <IconReport    size={18} /> },
  { key: "compliance",   label: "Conformité",             icon: <IconShield    size={18} /> },
  { key: "workshop",     label: "Atelier IA",             icon: <IconSparkles  size={18} /> },
  { key: "notifications",label: "Notifications",          icon: <IconBell      size={18} /> },
  { key: "profile",      label: "Mon Profil",             icon: <IconUser      size={18} /> },
]

/** Helper — pick the right nav list based on user role */
export function getNavItems(role?: string | null): NavItem[] {
  if (role === "ENCADRER") return ENCADRER_NAV_ITEMS
  if (role === "ADMIN")    return ADMIN_NAV_ITEMS
  return STUDENT_NAV_ITEMS
}
