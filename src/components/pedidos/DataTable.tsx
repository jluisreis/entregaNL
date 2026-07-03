/**
 * DataTable – Painel de Confirmar Entrega (Nobre Lar)
 *
 * Funcionalidades:
 *  - Exibe pedidos com NIVEL ENTREGA = NORMAL
 *  - Botão "Confirmar Entrega" registra data/hora automaticamente (hora do clique)
 *  - Opção de inserir data e hora manualmente antes de confirmar
 *  - Alimenta a planilha via Apps Script (POST)
 */

import { useState, useEffect, useCallback } from "react";
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
import { CheckCircle2, Clock, RefreshCw, Loader2 } from "lucide-react";

// ─── tipos ───────────────────────────────────────────────────────────────────

interface Pedido {
  _row: number;
  PEDIDO: string | number;
  "VALOR DO PEDIDO": string | number;
  VENDEDOR: string;
  "NIVEL ENTREGA": string;
  "ENTREGUE DATA"?: string;
  "ENTREGUE HORA"?: string;
  [key: string]: unknown;
}

// ─── env ─────────────────────────────────────────────────────────────────────

const SCRIPT_URL    = import.meta.env.VITE_APPS_SCRIPT_URL  as string;
const SCRIPT_SECRET = import.meta.env.VITE_APPS_SCRIPT_SECRET as string;

// ─── helpers ─────────────────────────────────────────────────────────────────

function nowDate(): string {
  const d = new Date();
  const dd  = String(d.getDate()).padStart(2, "0");
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const yy  = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (isNaN(num)) return String(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DataTable() {
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [confirmando, setConfirmando] = useState<number | null>(null); // _row em progresso

  // dialog de confirmação manual
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [dialogPedido, setDialogPedido] = useState<Pedido | null>(null);
  const [manualData, setManualData]   = useState("");
  const [manualHora, setManualHora]   = useState("");
  const [modoManual, setModoManual]   = useState(false);

  // ── carregar pedidos ──────────────────────────────────────────────────────

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      // ?nivel=NORMAL filtra no servidor — Apps Script retorna só os normais
      const res  = await fetch(`${SCRIPT_URL}?nivel=NORMAL`);
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

  // ── abrir dialog ──────────────────────────────────────────────────────────

  function abrirConfirmacao(pedido: Pedido) {
    setDialogPedido(pedido);
    setModoManual(false);
    setManualData(nowDate());
    setManualHora(nowTime());
    setDialogOpen(true);
  }

  // ── confirmar entrega (POST) ──────────────────────────────────────────────

  async function confirmarEntrega(pedido: Pedido, data?: string, hora?: string) {
    setConfirmando(pedido._row);
    setDialogOpen(false);
    try {
      const body = {
        secret : SCRIPT_SECRET,
        action : "confirmar",
        row    : pedido._row,
        // se não passar data/hora, o Apps Script usa o horário atual do servidor
        ...(data ? { data } : {}),
        ...(hora ? { hora } : {}),
      };

      const res  = await fetch(SCRIPT_URL, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success(
        `Entrega confirmada — Pedido ${pedido.PEDIDO}: ${json.data} às ${json.hora}`
      );

      // atualiza localmente sem recarregar tudo
      setPedidos(prev =>
        prev.map(p =>
          p._row === pedido._row
            ? { ...p, "ENTREGUE DATA": json.data, "ENTREGUE HORA": json.hora }
            : p
        )
      );
    } catch (err) {
      toast.error("Erro ao confirmar: " + (err as Error).message);
    } finally {
      setConfirmando(null);
    }
  }

  function handleConfirmarClick(pedido: Pedido) {
    abrirConfirmacao(pedido);
  }

  function handleDialogConfirmar() {
    if (!dialogPedido) return;
    if (modoManual) {
      confirmarEntrega(dialogPedido, manualData, manualHora);
    } else {
      // usa hora exata do clique — não passa data/hora, Apps Script registra o agora
      confirmarEntrega(dialogPedido);
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">

      {/* cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pedidos — Nível Normal</h2>
          <p className="text-sm text-gray-500">{pedidos.length} pedido(s) carregado(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPedidos} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* tabela */}
      <div className="rounded-xl border overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Nº Pedido</TableHead>
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
                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Carregando pedidos…
                </TableCell>
              </TableRow>
            )}

            {!loading && pedidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                  Nenhum pedido com nível NORMAL encontrado.
                </TableCell>
              </TableRow>
            )}

            {!loading && pedidos.map(pedido => {
              const jaEntregue = !!(pedido["ENTREGUE DATA"] || pedido["ENTREGUE HORA"]);
              const emProgresso = confirmando === pedido._row;

              return (
                <TableRow
                  key={pedido._row}
                  className={jaEntregue ? "bg-green-50" : ""}
                >
                  {/* nº pedido */}
                  <TableCell className="font-mono font-medium">
                    {String(pedido.PEDIDO)}
                  </TableCell>

                  {/* valor */}
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(pedido["VALOR DO PEDIDO"])}
                  </TableCell>

                  {/* vendedor */}
                  <TableCell>{pedido.VENDEDOR || "—"}</TableCell>

                  {/* entregue data */}
                  <TableCell className="tabular-nums">
                    {pedido["ENTREGUE DATA"] || (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>

                  {/* entregue hora */}
                  <TableCell className="tabular-nums">
                    {pedido["ENTREGUE HORA"] || (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>

                  {/* ação */}
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
                        onClick={() => handleConfirmarClick(pedido)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {emProgresso
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar Entrega</>
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

      {/* ── dialog de confirmação ─────────────────────────────────────────── */}
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
              {/* resumo do pedido */}
              <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pedido</span>
                  <span className="font-mono font-semibold">{String(dialogPedido.PEDIDO)}</span>
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

              {/* toggle manual / automático */}
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

              {/* campos manuais */}
              {modoManual && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Data (dd/MM/aa)
                    </label>
                    <Input
                      placeholder="03/07/26"
                      value={manualData}
                      onChange={e => setManualData(e.target.value)}
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Hora (HH:mm)
                    </label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
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
