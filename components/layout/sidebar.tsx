"use client";

import Link from "next/link";
import {
  Home,
  LayoutDashboard,
  Building2,
  TrendingUp,
  Radar,
  ScanSearch,
  Zap,
  Code2,
  Calculator,
  FileText,
  Briefcase,
  BookOpen,
  Mail,
  Bot,
  Send,
  Target,
  PhoneCall,
  PenTool,
  AudioLines,
} from "lucide-react";

import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";
import { LogoMark } from "@/components/brand/logo-mark";

const navItems: DockItem[] = [
  { title: "Home", href: "/home", icon: <Home className="h-full w-full" /> },
  { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-full w-full" /> },
  { title: "Companies", href: "/companies", icon: <Building2 className="h-full w-full" /> },
  { title: "Market Intelligence", href: "/market-intelligence", icon: <TrendingUp className="h-full w-full" /> },
  { title: "Rastreador", href: "/rastreador", icon: <Radar className="h-full w-full" /> },
  { title: "Analyzer", href: "/analyzer", icon: <ScanSearch className="h-full w-full" /> },
  { title: "Opportunity Engine", href: "/opportunity-engine", icon: <Zap className="h-full w-full" /> },
  { title: "MVP Factory", href: "/mvp-factory", icon: <Code2 className="h-full w-full" /> },
  { title: "Pricing Studio", href: "/pricing-studio", icon: <Calculator className="h-full w-full" /> },
  { title: "Proposal Builder", href: "/proposal-builder", icon: <FileText className="h-full w-full" /> },
  { title: "Delivery Workspace", href: "/delivery-workspace", icon: <Briefcase className="h-full w-full" /> },
  { title: "Email Generator", href: "/email-generator", icon: <Mail className="h-full w-full" /> },
  { title: "Outreach Agent", href: "/outreach-agent", icon: <Send className="h-full w-full" /> },
  { title: "Competitor Radar", href: "/competitor-radar", icon: <Target className="h-full w-full" /> },
  { title: "Call Prep Agent", href: "/call-prep", icon: <PhoneCall className="h-full w-full" /> },
  { title: "Content/SEO Agent", href: "/content-seo", icon: <PenTool className="h-full w-full" /> },
  { title: "Transcript Analyzer", href: "/transcript-analyzer", icon: <AudioLines className="h-full w-full" /> },
  { title: "AI Agents", href: "/ai-agents", icon: <Bot className="h-full w-full" /> },
  { title: "Knowledge Base", href: "/knowledge-base", icon: <BookOpen className="h-full w-full" /> },
];

export function Sidebar() {
  // z-50 keeps the hover labels (which overflow into the content area) above
  // the Leaflet map's internal stacking context.
  return (
    <aside className="relative z-50 flex w-20 flex-shrink-0 flex-col items-center border-r border-border bg-card py-3 print:hidden">
      <Link
        href="/home"
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-primary/5 text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
        title="NZT Studio"
      >
        <LogoMark className="h-5 w-5" />
      </Link>

      <FloatingDock items={navItems} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none" />

      <div
        className="mt-2 h-2 w-2 rounded-full bg-emerald-400"
        title="System active"
      />
    </aside>
  );
}
