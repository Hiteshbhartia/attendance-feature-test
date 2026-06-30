import { useSyncExternalStore } from "react";
import { makeStore } from "./store";
import { api } from "./api-client";

export type Zone = {
  id: string;
  name: string;
  city: string;
  pods: number;
  leaderId: string;
  properties: number;
  type?: string;
};

export type Property = {
  id: string;
  zoneId: string;
  name: string;
  type: "Boys" | "Girls" | "Co-living";
  address: string;
  rating: number;
  beds: number;
  occupied: number;
  monthlyRevenue: number;
  partnerId: string;
};

interface ZonesState {
  zones: Zone[];
  properties: Property[];
  hydrated: boolean;
}

const SEED: ZonesState = { zones: [], properties: [], hydrated: false };

export const store = makeStore<ZonesState>("gp_zones_v1", SEED);

export function useZoneStore() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.read(),
    store.getServerSnapshot
  );
}

export async function hydrateZones() {
  try {
    const [zRes, pRes] = await Promise.all([
      api.get<any[]>("/zones"),
      api.get<any[]>("/zones/properties")
    ]);
    store.write({ zones: zRes, properties: pRes, hydrated: true });
    return true;
  } catch (err) {
    console.error("[hydrate] zones failed:", err);
    return false;
  }
}

export async function createZone(data: Partial<Zone>) {
  const newZone = await api.post<Zone>("/zones", data);
  const current = store.read();
  store.write({ ...current, zones: [...current.zones, newZone] });
  return newZone;
}

export async function updateZone(id: string, data: Partial<Zone>) {
  const updatedZone = await api.patch<Zone>(`/zones/${id}`, data);
  const current = store.read();
  store.write({
    ...current,
    zones: current.zones.map((z) => (z.id === id ? updatedZone : z)),
  });
  return updatedZone;
}

export function propertiesOfZone(zoneId: string) {
  const { properties } = store.read();
  return properties.filter(p => p.zoneId === zoneId);
}

export function propertiesOfPartner(partnerId: string) {
  // Temporary mock implementation based on old partner.tsx logic
  const { properties } = store.read();
  if (partnerId === "e24") return properties.filter(p => p.zoneId === "z1");
  if (partnerId === "e25") return properties.filter(p => p.zoneId === "z2");
  return properties; // return all for demo
}

export type PartnerPayout = {
  id: string;
  propertyId: string;
  month: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
};

export type PartnerTicket = {
  id: string;
  propertyId: string;
  openedBy: string;
  title: string;
  category: "Maintenance" | "Billing" | "Tenant" | "Compliance" | "Other";
  priority: "High" | "Med" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  assigneeId?: string;
  ts: number;
  lastUpdate?: string;
};

export const PARTNER_PAYOUTS: PartnerPayout[] = [];
export const PARTNER_TICKETS: PartnerTicket[] = [];

export function payoutsOfPartner(partnerId: string) {
  return PARTNER_PAYOUTS;
}

export function ticketsOfPartner(partnerId: string) {
  return PARTNER_TICKETS;
}

export function ticketsOfZone(zoneId: string): any[] {
  return []; // Mock
}

export function inr(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}

export function occPct(p: Property) {
  if (p.beds === 0) return 0;
  return Math.round((p.occupied / p.beds) * 100);
}
