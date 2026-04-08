import { redirect } from "next/navigation";
import { getDashboardSummary } from "@/lib/data";
import { getSession } from "@/lib/auth";
import SummaryCards from "@/components/dashboard/SummaryCards";
import SpendingByCategory from "@/components/dashboard/SpendingByCategory";
import MonthlyTrend from "@/components/dashboard/MonthlyTrend";
import TopMerchants from "@/components/dashboard/TopMerchants";
import FeeBreakdown from "@/components/dashboard/FeeBreakdown";
import { DashboardFilter } from "@/components/dashboard/DashboardFilter";
import Link from "next/link";
import { PlusCircle, Upload, Calendar } from "lucide-react";

function prevMonthParam() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; months?: string };
}) {
  // Default: mes anterior
  if (!searchParams.month && !searchParams.months) {
    redirect(`/dashboard?month=${prevMonthParam()}`);
  }

  let from: Date | undefined;
  let to: Date | undefined;
  let months = 6;

  if (searchParams.month) {
    const [y, m] = searchParams.month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59);
  } else if (searchParams.months) {
    months = Math.max(1, Math.min(24, parseInt(searchParams.months, 10) || 6));
  }

  const session = await getSession();
  const data = await getDashboardSummary({ months, from, to, userId: session?.userId });

  const periodLabel = searchParams.month
    ? new Date(from!.getFullYear(), from!.getMonth(), 1)
        .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : `Últimos ${months} ${months === 1 ? "mes" : "meses"}`;

  const filter = (
    <DashboardFilter
      currentMonth={searchParams.month}
      currentMonths={searchParams.months ? parseInt(searchParams.months, 10) : undefined}
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
              No hay transacciones registradas para este período.
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
            <Link
              href="/upload"
              className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <Upload className="h-4 w-4" />
              Importar resumen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {filter}
      <SummaryCards
        totalCurrentBalance={data.totalCurrentBalance}
        totalCurrentBalanceUsd={data.totalCurrentBalanceUsd}
        totalSpendingThisMonth={data.totalSpendingThisMonth}
        totalSpendingLastMonth={data.totalSpendingLastMonth}
        spendingChangePercent={data.spendingChangePercent}
        totalFees={data.feeBreakdown.total}
        periodLabel={periodLabel}
        isMonthFilter={!!searchParams.month}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MonthlyTrend data={data.monthlyTrend} />
        <SpendingByCategory
          data={data.spendingByCategory}
          currentMonth={searchParams.month}
          currentMonths={searchParams.months ? parseInt(searchParams.months, 10) : undefined}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopMerchants data={data.topMerchants} />
        <FeeBreakdown data={data.feeBreakdown} />
      </div>
    </div>
  );
}
