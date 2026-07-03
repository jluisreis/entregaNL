export interface Pedido {
  _row: number;
  ID: string | number;
  "NIVEL ENTREGA": string;
  LOJA: string;
  PEDIDO: string | number;
  "VALOR DO PEDIDO": string | number;
  LOGISTICA: string;
  DATA: string;
  ENTRADA: string;
  VENDEDOR: string;
  TRANFERENCIA: string;
  FATURAMENTO: string;
  CIDADE: string;
  RESPONSAVEL: string;
  SAIDA: string;
  "ENTREGUE DATA": string;
  "ENTREGUE HORA": string;
  ENTREGA: string;
  [k: string]: unknown;
}

const URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
const SECRET = import.meta.env.VITE_APPS_SCRIPT_SECRET as string | undefined;

export function isConfigured() {
  return Boolean(URL && SECRET);
}

export async function fetchPedidos(): Promise<Pedido[]> {
  if (!URL) throw new Error("VITE_APPS_SCRIPT_URL não configurado");
  const res = await fetch(URL, { method: "GET", redirect: "follow" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro ao carregar pedidos");
  return json.rows as Pedido[];
}

export interface ConfirmarInput {
  row: number;
  data?: string; // dd/MM/yy
  hora?: string; // HH:mm
}

export async function confirmarEntrega(input: ConfirmarInput) {
  if (!URL || !SECRET) throw new Error("Backend não configurado");
  const res = await fetch(URL, {
    method: "POST",
    redirect: "follow",
    // text/plain evita preflight CORS no Apps Script
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: SECRET, action: "confirmar", ...input }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro ao confirmar entrega");
  return json as { ok: true; row: number; data: string; hora: string };
}
