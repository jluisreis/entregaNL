import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface Props {
  isDark: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function Header({ isDark, onToggle }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div>
        <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
          Painel de Entregas
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nobre Lar
          {now
            ? " · " +
              now.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : ""}
        </p>
      </div>
      <button
        onClick={onToggle}
        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Alternar tema"
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600" />
        )}
      </button>
    </header>
  );
}
