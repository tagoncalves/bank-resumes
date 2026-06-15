import { redirect } from "next/navigation";
import { getDashboardSummary } from "@/lib/data";
import { getSession } from "@/lib/auth";
import SummaryCards from "@/components/dashboard/SummaryCards";
import IncomeExpenseTrend from "@/components/dashboard/IncomeExpenseTrend";
import SpendingByCategory from "@/components/dashboard/SpendingByCategory";
import MonthlyTrend from "@/components/dashboard/MonthlyTrend";
import SavingsWidget from "@/components/dashboard/SavingsWidget";
import TopMerchants from "@/components/dashboard/TopMerchants";
import { DashboardFilter } from "@/components/dashboard/DashboardFilter";
import Link from "next/link";
import { PlusCircle, Upload, Calendar } from "lucide-react";
import OpenUploadButton from "@/components/upload/OpenUploadButton";

function prevMonthParam() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; months?: string; origin?: string }>;
}) {
  const sp = await searchParams;

  // Default: mes anterior
  if (!sp.month && !sp.months) {
    redirect(`/dashboard?month=${prevMonthParam()}`);
  }

  let from: Date | undefined;
  let to: Date | undefined;
  let months = 6;

  if (sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59);
  } else if (sp.months) {
    months = Math.max(1, Math.min(24, parseInt(sp.months, 10) || 6));
  }

  const origin = sp.origin ?? "all";

  const session = await getSession();
  const data = await getDashboardSummary({ months, from, to, userId: session?.userId, origin });

  const periodLabel = sp.month
    ? new Date(from!.getFullYear(), from!.getMonth(), 1)
        .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : `Últimos ${months} ${months === 1 ? "mes" : "meses"}`;

  const filter = (
      <DashboardFilter
        currentMonth={sp.month}
        currentMonths={sp.months ? parseInt(sp.months, 10) : undefined}
        currentOrigin={origin}
      />
  );

  if (data.totalTransactionCount === 0) {
    return (
      <div className="space-y-5">
        {filter}
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Calendar className="h-6 w-6 text-zinc-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-700">
              Sin movimientos en {periodLabel}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              No hay ingresos ni egresos registrados para este período.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/transactions"
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <PlusCircle className="h-4 w-4" />
              Crear movimiento
            </Link>
            <OpenUploadButton
              kind="statement"
              className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <Upload className="h-4 w-4" />
              Importar resumen
            </OpenUploadButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {filter}
        <SummaryCards
          totalIncomeArs={data.totalIncomeArs}
          totalExpenseArs={data.totalExpenseArs}
          netBalanceArs={data.netBalanceArs}
          netBalanceUsd={data.netBalanceUsd}
          periodLabel={periodLabel}
        />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MonthlyTrend data={data.monthlyTrend} />
        <IncomeExpenseTrend data={data.monthlyTrend} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SpendingByCategory
          data={data.spendingByCategory}
          currentMonth={sp.month}
          currentMonths={sp.months ? parseInt(sp.months, 10) : undefined}
          currentOrigin={origin}
        />
        <SavingsWidget
          cumulativeNetSavings={data.cumulativeNetSavings}
          averageMonthlyNet={data.averageMonthlyNet}
          periodLabel={periodLabel}
        />
      </div>
      <div className="grid grid-cols-1 gap-5">
        <TopMerchants data={data.topMerchants} />
      </div>
    </div>
  );
}
