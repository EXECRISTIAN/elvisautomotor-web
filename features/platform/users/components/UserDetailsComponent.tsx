"use client";
import { formatInZone } from '@/features/dashboard/lib/storeTime';

import React, { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { basePath } from "@/features/dashboard/lib/config";
import { Facts, Pill, Status, Td, Tr, type DeskTone } from "@/features/platform/components/desk";
import { EditItemDrawerClientWrapper } from "../../components/EditItemDrawerClientWrapper";

interface UserDetailsComponentProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    isSalesperson?: boolean | null;
    isServiceAdvisor?: boolean | null;
    isFinanceManager?: boolean | null;
    role?: { id: string; name: string } | null;
    assignedLeadsCount?: number | null;
    dealsCount?: number | null;
    createdAt?: string | null;
  };
  list: any;
}

export function staffFunctions(user: UserDetailsComponentProps["user"]) {
  const functions: Array<{ label: string; tone: DeskTone }> = [];
  if (user.isSalesperson) functions.push({ label: "Ventas", tone: "info" });
  if (user.isServiceAdvisor) functions.push({ label: "Servicio", tone: "warn" });
  if (user.isFinanceManager) functions.push({ label: "Financiación", tone: "accent" });
  return functions;
}

/** Number of columns the staff table renders; the details row spans all of them. */
export const STAFF_COLUMNS = 6;

/** One staff member as a table row, with an expandable details row beneath. */
export function UserDetailsComponent({ user }: UserDetailsComponentProps) {
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const leads = user.assignedLeadsCount ?? 0;
  const deals = user.dealsCount ?? 0;
  const functions = staffFunctions(user);
  const displayName = user.name || user.email;
  const joined = user.createdAt
    ? formatInZone(user.createdAt, undefined, "date")
    : null;

  return (
    <>
      <Tr>
        <Td className="max-w-0 min-w-[10rem]">
          <Link href={`${basePath}/users/${user.id}`} className="block font-medium text-foreground [overflow-wrap:anywhere] hover:underline">
            {displayName}
          </Link>
          <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {user.email}
            {user.phone && <span className="max-sm:hidden"> · {user.phone}</span>}
          </span>
        </Td>
        <Td priority={2}>
          {user.role ? <span className="text-foreground">{user.role.name}</span> : <span className="text-muted-foreground">Ninguno</span>}
        </Td>
        <Td priority={3} className="text-muted-foreground">
          {functions.length ? functions.map((item) => item.label).join(", ") : "Ninguno"}
        </Td>
        <Td>
          {user.role ? <Status tone="ok">Activo</Status> : <Status tone="warn">Sin rol</Status>}
        </Td>
        <Td align="right" priority={2} className="whitespace-nowrap text-muted-foreground">
          {leads} {leads === 1 ? "lead" : "leads"} · {deals} {deals === 1 ? "deal" : "deals"}
        </Td>
        <Td align="right" className="w-px whitespace-nowrap">
          <div className="inline-flex items-center gap-1">
            <Pill
              size="sm"
              variant={isOpen ? undefined : "plain"}
              aria-expanded={isOpen}
              onClick={() => setIsOpen((open) => !open)}
              className="max-sm:h-10"
            >
              Detalles
            </Pill>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pill size="sm" variant="plain" aria-label={`Acciones para ${displayName}`} className="max-sm:h-10 max-sm:w-10">
                  <MoreHorizontal />
                </Pill>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditDrawerOpen(true)}>
                  Editar integrante
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`${basePath}/users/${user.id}`}>Abrir registro completo</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <EditItemDrawerClientWrapper
            listKey="users"
            itemId={user.id}
            open={isEditDrawerOpen}
            onClose={() => setIsEditDrawerOpen(false)}
            onSave={() => {
              window.location.reload();
            }}
          />
        </Td>
      </Tr>

      {isOpen && (
        <tr className="border-b bg-muted/30">
          <td colSpan={STAFF_COLUMNS} className="px-4 py-1">
            <Facts
              className="grid gap-x-8 divide-y-0 md:grid-cols-2 [&>div]:border-b [&>div]:border-border/60"
              items={[
                { label: "Email", value: user.email || "Ninguno" },
                { label: "Teléfono", value: user.phone || "Ninguno" },
                { label: "Rol", value: user.role?.name || "Ninguno" },
                { label: "Funciones", value: functions.length ? functions.map((item) => item.label).join(", ") : "Ninguno" },
                { label: "Consultas asignadas", value: leads },
                { label: "Operaciones", value: deals },
                joined ? { label: "Ingresó", value: joined } : null,
              ]}
            />
          </td>
        </tr>
      )}
    </>
  );
}
