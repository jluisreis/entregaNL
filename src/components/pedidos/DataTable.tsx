/**
 * DataTable – Painel de Confirmar Entrega (Nobre Lar)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Clock, RefreshCw, Loader2, CalendarRange, X } from "lucide-react";

// ─── tipos ───────────────────────────────────────────────────────────────────

interface Pedido {
  _row: number;
  PEDIDO: string | number;
  "VALOR DO PEDIDO": string | number;
  VENDEDOR: string;
  "NIVEL ENTREGA": string;
  DATA?: string;
  "ENTREGUE DATA"?: string;
  "ENTREGUE HORA"?: string;
  [key: string]: unknown;
}

// ─── env ─────────────────────────────────────────────────────────────────────

const SCRIPT_URL    = import.meta.env.VITE_APPS_SCRIPT_URL   as string;
const SCRIPT_SECRET = import.meta.env.VITE_APPS_SCRIPT_SECRET as string;

// ─── helpers ─────────────────────────────────────────────────────────────────

function nowDate(): string {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getFullYear()).slice(-2),
  ].join("/");
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCurrency(value: string | number): string {
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return String(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateBR(str: string): Date | null {
  if (!str) return null;
  const parts = String(str).trim().split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyRaw] = parts;
  const yyyy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  const d = new Date(yyyy, Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}

function parseInputDate(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Monta URL do Apps Script com query params — evita o problema de CORS do POST */
function buildUrl(params: Record<string, string | number>): string {
  const qs = new URLSearchParams(
    Object.entries(params).reduce(
      (acc, [k, v]) => ({ ...acc, [k]: String(v) }),
      {} as Record<string, string>
    )
  ).toString();
  return `${SCRIPT_URL}?${qs}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DataTable() {
  const [pedidos, setPedidos]         = useState<Pedido[]>([]);
  const [loading, setLoading]         = useState(true);
  const [confirmando, setConfirmando] = useState<number | null>(null);

  const [filtroDe,  setFiltroDe]  = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [dialogPedido, setDialogPedido] = useState<Pedido | null>(null);
  const [manualData,   setManualData]   = useState("");
  const [manualHora,   setManualHora]   = useState("");
  const [modoManual,   setModoManual]   = useState(false);

  // ── carregar pedidos ──────────────────────────────────────────────────────

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const url  = buildUrl({ action: "listar", secret: SCRIPT_SECRET, nivel: "NORMAL" });
      const res  = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPedidos(json.rows as Pedido[]);
    } catch (err) {
      toast.error("Erro ao carregar pedidos: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  // ── ordenação + filtro ────────────────────────────────────────────────────

  const pedidosFiltrados = useMemo(() => {
    const deDate  = parseInputDate(filtroDe);
    const ateDate = parseInputDate(filtroAte);

    return [...pedidos]
      .sort((a, b) => {
        const da = parseDateBR(a.DATA ?? "");
        const db = parseDateBR(b.DATA ?? "");
        if (!da && !db) return b._row - a._row;
        if (!da) return 1;
        if (!db) return -1;
        return db.getTime() - da.getTime();
      })
      .filter(p => {
        if (!deDate && !ateDate) return true;
        const dp = parseDateBR(p.DATA ?? "");
        if (!dp) return true;
        if (deDate  && dp < deDate)  return false;
        if (ateDate && dp > ateDate) return false;
        return true;
      });
  }, [pedidos, filtroDe, filtroAte]);

  const temFiltro = filtroDe || filtroAte;

  // ── confirmar entrega via GET (evita CORS do POST) ────────────────────────

  async function confirmarEntrega(pedido: Pedido, data?: string, hora?: string) {
    setConfirmando(pedido._row);
    setDialogOpen(false);
    try {
      const params: Record<string, string | number> = {
        action: "confirmar",
        secret: SCRIPT_SECRET,
        row   : pedido._row,
      };
      // se modo automático, não envia data/hora — o servidor usa o momento atual
      if (data) params.data = data;
      if (hora) params.hora = hora;

      const url  = buildUrl(params);
      const res  = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success(
        `✅ Pedido ${pedido.PEDIDO} confirmado: ${json.data} às ${json.hora}`
      );

      // atualiza o estado local imediatamente
      setPedidos(prev =>
        prev.map(p =>
          p._row === pedido._row
            ? { ...p, "ENTREGUE DATA": json.data, "ENTREGUE HORA": json.hora }
            : p
        )
      );
    } catch (err) {
      toast.error("Erro ao confirmar entrega: " + (err as Error).message);
    } finally {
      setConfirmando(null);
    }
  }

  function abrirConfirmacao(pedido: Pedido) {
    setDialogPedido(pedido);
    setModoManual(false);
    setManualData(nowDate());
    setManualHora(nowTime());
    setDialogOpen(true);
  }

  function handleDialogConfirmar() {
    if (!dialogPedido) return;
    if (modoManual) {
      confirmarEntrega(dialogPedido, manualData, manualHora);
    } else {
      confirmarEntrega(dialogPedido); // sem data/hora → servidor usa agora
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">

      {/* cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pedidos — Nível Normal</h2>
          <p className="text-sm text-gray-500">
            {pedidosFiltrados.length} de {pedidos.length} pedido(s)
            {temFiltro ? " (filtrado)" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPedidos} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* filtro de intervalo */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-gray-50 px-4 py-3">
        <CalendarRange className="w-4 h-4 text-gray-400 self-center shrink-0" />
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">De</label>
          <Input
            type="date"
            value={filtroDe}
            onChange={e => setFiltroDe(e.target.value)}
            className="w-40 text-sm bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Até</label>
          <Input
            type="date"
            value={filtroAte}
            onChange={e => setFiltroAte(e.target.value)}
            className="w-40 text-sm bg-white"
          />
        </div>
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFiltroDe(""); setFiltroAte(""); }}
            className="text-gray-500 hover:text-gray-700 self-end"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* tabela */}
      <div className="rounded-xl border overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Nº Pedido</TableHead>
              <TableHead className="font-semibold">Data do Pedido</TableHead>
              <TableHead className="font-semibold">Valor</TableHead>
              <TableHead className="font-semibold">Vendedor</TableHead>
              <TableHead className="font-semibold">Entregue Data</TableHead>
              <TableHead className="font-semibold">Entregue Hora</TableHead>
              <TableHead className="font-semibold text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Carregando pedidos…
                </TableCell>
              </TableRow>
            )}

            {!loading && pedidosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  {temFiltro
                    ? "Nenhum pedido no intervalo selecionado."
                    : "Nenhum pedido com nível NORMAL encontrado."}
                </TableCell>
              </TableRow>
            )}

            {!loading && pedidosFiltrados.map(pedido => {
              const jaEntregue  = !!(pedido["ENTREGUE DATA"] || pedido["ENTREGUE HORA"]);
              const emProgresso = confirmando === pedido._row;

              return (
                <TableRow
                  key={pedido._row}
                  className={jaEntregue ? "bg-green-50" : ""}
                >
                  <TableCell className="font-mono font-medium">
                    {String(pedido.PEDIDO)}
                  </TableCell>
                  <TableCell className="tabular-nums text-gray-700">
                    {pedido.DATA
                      ? <span className="font-medium">{pedido.DATA}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(pedido["VALOR DO PEDIDO"])}
                  </TableCell>
                  <TableCell>{pedido.VENDEDOR || "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {pedido["ENTREGUE DATA"] || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {pedido["ENTREGUE HORA"] || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {jaEntregue ? (
                      <Badge
                        variant="outline"
                        className="border-green-500 text-green-700 bg-green-50 gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Entregue
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={emProgresso}
                        onClick={() => abrirConfirmacao(pedido)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {emProgresso
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><CheckCircle2 className="w-4 h-4 mr-1" />Confirmar Entrega</>
                        }
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Confirmar Entrega
            </DialogTitle>
          </DialogHeader>

          {dialogPedido && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pedido</span>
                  <span className="font-mono font-semibold">{String(dialogPedido.PEDIDO)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data do pedido</span>
                  <span>{dialogPedido.DATA || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(dialogPedido["VALOR DO PEDIDO"])}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendedor</span>
                  <span>{dialogPedido.VENDEDOR || "—"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModoManual(false)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    !modoManual
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  Hora do clique
                </button>
                <button
                  type="button"
                  onClick={() => setModoManual(true)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    modoManual
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Inserir manualmente
                </button>
              </div>

              {modoManual && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Data (dd/MM/aa)</label>
                    <Input
                      placeholder="03/07/26"
                      value={manualData}
                      onChange={e => setManualData(e.target.value)}
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Hora (HH:mm)</label>
                    <Input
                      placeholder="14:30"
                      value={manualHora}
                      onChange={e => setManualHora(e.target.value)}
                      maxLength={5}
                    />
                  </div>
                </div>
              )}

              {!modoManual && (
                <p className="text-xs text-gray-400 text-center">
                  A data e hora exata do clique serão registradas automaticamente.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleDialogConfirmar}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
