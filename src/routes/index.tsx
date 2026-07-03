import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Header from "@/components/pedidos/Header";
import DataTable from "@/components/pedidos/DataTable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Entregas · Nobre Lar" },
      {
        name: "description",
        content:
          "Painel gerencial de vendas, faturamento e entregas Nobre Lar. Confirme entregas em tempo real com sincronização direta na planilha do Google Sheets.",
      },
      { property: "og:title", content: "Painel de Entregas · Nobre Lar" },
      {
        property: "og:description",
        content:
          "Confirme entregas em tempo real com sincronização direta na planilha do Google Sheets.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [isDark, setIsDark] = useState(true);
  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
        <Header isDark={isDark} onToggle={() => setIsDark((v) => !v)} />
        <main className="p-4 lg:p-6 max-w-7xl mx-auto">
          <DataTable />
        </main>
      </div>
    </div>
  );
}
