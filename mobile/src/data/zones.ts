// Core Arena — Zones & Properties model.
// Zones are operational regions. Each property belongs to one zone and one partner.

export type Zone = {
  id: string;
  name: string;
  city: string;
  leaderId: string; // employeeId of Zone Leader
  pods: number;
  properties: number;
  type?: "PG" | "Flat";
};

export type Property = {
  id: string;
  name: string;
  zoneId: string;
  partnerId: string; // employeeId of Property Partner
  beds: number;
  occupied: number;
  monthlyRevenue: number; // INR
  rating: number; // 0..5
  address: string;
  type: "Boys" | "Girls" | "Co-living";
};

export type PartnerTicket = {
  id: string;
  propertyId: string;
  openedBy: string; // partnerId or staffId
  title: string;
  category: "Maintenance" | "Billing" | "Tenant" | "Compliance" | "Other";
  status: "Open" | "In Progress" | "Resolved";
  priority: "Low" | "Med" | "High";
  ts: number;
  assigneeId?: string;
  lastUpdate?: string;
};

export type PartnerPayout = {
  id: string;
  partnerId: string;
  propertyId: string;
  month: string; // "Apr 2026"
  gross: number;
  deductions: number;
  net: number;
  status: "Scheduled" | "Paid" | "On Hold";
  paidAt?: number;
};

import { store } from "@/lib/zones-store";

export function zoneOf(id: string): Zone | undefined {
  return store.read().zones.find((z) => z.id === id) as Zone | undefined;
}
export function propertiesOfZone(zoneId: string): Property[] {
  return store.read().properties.filter((p) => p.zoneId === zoneId) as Property[];
}
export function propertiesOfPartner(partnerId: string): Property[] {
  return store.read().properties.filter((p) => p.partnerId === partnerId) as Property[];
}
export function payoutsOfPartner(partnerId: string): PartnerPayout[] {
  // Can be extended to read from a payouts store if needed
  return [];
}
export function ticketsOfPartner(partnerId: string): PartnerTicket[] {
  return [];
}
export function ticketsOfZone(zoneId: string): PartnerTicket[] {
  return [];
}

export const inr = (n: number) =>
  "₹" +
  (n >= 10000000
    ? (n / 10000000).toFixed(2) + " Cr"
    : n >= 100000
      ? (n / 100000).toFixed(1) + " L"
      : n.toLocaleString("en-IN"));

export const occPct = (p: Property) => Math.round((p.occupied / p.beds) * 100);
