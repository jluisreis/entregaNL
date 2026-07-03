import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Search,
  Package,
  TrendingUp,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";
import { confirmarEntrega, fetchPedidos, isConfigured, type Pedido } from "@/lib/pedidos-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const ROWS = 10;

function toBRL(v: unknown) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  if (!isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DataTable() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(""); // yyyy-mm-dd
  const [modal, setModal] = useState<Pedido | null>(null);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [useManual, setUseManual] = useState(false);

  const configured = isConfigured();

  const query = useQuery({
    queryKey: ["pedidos"],
    queryFn: fetchPedidos,
    enabled: configured,
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: confirmarEntrega,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      setModal(null);
      setUseManual(false);
      setManualDate("");
      setManualTime("");
    },
  });

  const rows = query.data ?? [];

  // Normaliza DATA do pedido para yyyy-mm-dd
  const normalizeDate = (v: unknown): string => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    // dd/mm/yyyy ou dd/mm/yy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const d = m[1].padStart(2, "0");
      const mo = m[2].padStart(2, "0");
      let y = m[3];
      if (y.length === 2) y = "20" + y;
      return `${y}-${mo}-${d}`;
    }
    // ISO
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return "";
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let out = rows;
    if (s) {
      out = out.filter((r) =>
        [r.PEDIDO, r.VENDEDOR, r.CIDADE, r.LOJA, r.RESPONSAVEL]
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(s)),
      );
    }
    if (dateFrom || dateTo) {
      out = out.filter((r) => {
        const d = normalizeDate(r.DATA);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }
    // Ordena pelos mais recentes primeiro (última linha adicionada na planilha)
    return [...out].sort((a, b) => Number(b._row) - Number(a._row));
  }, [rows, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS));
  const start = (page - 1) * ROWS;
  const pageData = filtered.slice(start, start + ROWS);

  const entregues = rows.filter((r) => String(r["ENTREGUE DATA"] ?? "").trim()).length;
  const pendentes = rows.length - entregues;

  const openConfirm = (p: Pedido) => {
    setModal(p);
    const now = new Date();
    setManualDate(
      now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    );
    setManualTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    setUseManual(false);
  };

  const doConfirm = () => {
    if (!modal) return;
    mutation.mutate({
      row: modal._row,
      data: useManual ? manualDate : undefined,
      hora: useManual ? manualTime : undefined,
    });
  };

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-6 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-semibold mb-2">Backend não configurado</p>
        <p>
          Configure <code>VITE_APPS_SCRIPT_URL</code> e <code>VITE_APPS_SCRIPT_SECRET</code> no
          arquivo <code>.env</code>. Veja instruções em <code>docs/apps-script/README.md</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Total"
          value={rows.length}
          icon={<Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          tone="blue"
        />
        <SummaryCard
          label="Pendentes"
          value={pendentes}
          icon={<TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          tone="amber"
        />
        <SummaryCard
          label="Entregues"
          value={entregues}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          tone="emerald"
        />
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar pedido, vendedor, cidade..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700 dark:text-slate-200"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-700 dark:text-slate-200"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Limpar filtro de data"
            >
              Limpar
            </button>
          )}
          <button
            onClick={() => query.refetch()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Recarregar"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {query.isError && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10 p-3 text-sm text-red-800 dark:text-red-300">
          {(query.error as Error).message}
        </div>
      )}

      {/* Cards mobile */}
      <div className="lg:hidden space-y-3">
        {pageData.map((r) => {
          const entregue = Boolean(String(r["ENTREGUE DATA"] ?? "").trim());
          return (
            <div
              key={r._row}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {initials(String(r.VENDEDOR || r.LOJA || "?"))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {r.VENDEDOR || "—"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      #{r.PEDIDO} · {r.LOJA}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.CIDADE}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">
                    {toBRL(r["VALOR DO PEDIDO"])}
                  </span>
                  {r.DATA && (
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {r.DATA}
                    </span>
                  )}
                </div>
              </div>
              {entregue ? (
                <span className="inline-flex items-center justify-center w-full gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Entregue {r["ENTREGUE DATA"]} {r["ENTREGUE HORA"]}
                </span>
              ) : (
                <button
                  onClick={() => openConfirm(r)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar entrega
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabela desktop */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
              <Th>Pedido</Th>
              <Th>Data</Th>
              <Th>Loja</Th>
              <Th>Vendedor</Th>
              <Th>Cidade</Th>
              <Th>Valor</Th>
              <Th>Entrega</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r) => {
              const entregue = Boolean(String(r["ENTREGUE DATA"] ?? "").trim());
              return (
                <tr
                  key={r._row}
                  className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    #{r.PEDIDO}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {r.DATA || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{r.LOJA}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {initials(String(r.VENDEDOR || "?"))}
                      </div>
                      <span className="text-slate-800 dark:text-slate-200">
                        {r.VENDEDOR || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.CIDADE}</td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                    {toBRL(r["VALOR DO PEDIDO"])}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {entregue ? `${r["ENTREGUE DATA"]} ${r["ENTREGUE HORA"]}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {entregue ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Entregue
                      </span>
                    ) : (
                      <button
                        onClick={() => openConfirm(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirmar entrega
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageData.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length === 0 ? 0 : start + 1}-{Math.min(start + ROWS, filtered.length)} de{" "}
          {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <span className="px-3 py-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Modal Confirmar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                Confirmar entrega
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Pedido <span className="font-mono font-semibold">#{modal.PEDIDO}</span> —{" "}
                {modal.CIDADE}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={!useManual}
                  onChange={() => setUseManual(false)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Usar horário atual</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />O servidor registra a data e hora exatas do clique.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  checked={useManual}
                  onChange={() => setUseManual(true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Informar manualmente</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="dd/mm/aa"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      disabled={!useManual}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
                    />
                    <input
                      type="text"
                      placeholder="HH:mm"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      disabled={!useManual}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              </label>

              {mutation.isError && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {(mutation.error as Error).message}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={doConfirm}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {mutation.isPending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald";
}) {
  const bg = {
    blue: "bg-blue-100 dark:bg-blue-900/30",
    amber: "bg-amber-100 dark:bg-amber-900/30",
    emerald: "bg-emerald-100 dark:bg-emerald-900/30",
  }[tone];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
