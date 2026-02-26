// backend calls live here

import { API_BASE_URL } from "@/constants/config";

export type HealthResponse = { status: string };

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}