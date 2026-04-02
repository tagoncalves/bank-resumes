import SummaryCards from "@/components/dashboard/SummaryCards";
import SpendingByCategory from "@/components/dashboard/SpendingByCategory";
import MonthlyTrend from "@/components/dashboard/MonthlyTrend";
import TopMerchants from "@/components/dashboard/TopMerchants";
import FeeBreakdown from "@/components/dashboard/FeeBreakdown";

async function getDashboardData() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/dashboard/summary?months=6`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-zinc-700">Sin resúmenes importados</p>
        <p className="text-sm text-zinc-500">
          Importá tu primer resumen de tarjeta para ver el dashboard.
        </p>
        <a
          href="/upload"
          className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Importar resumen
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SummaryCards
        totalCurrentBalance={data.totalCurrentBalance}
        totalCurrentBalanceUsd={data.totalCurrentBalanceUsd}
        totalSpendingThisMonth={data.totalSpendingThisMonth}
        totalSpendingLastMonth={data.totalSpendingLastMonth}
        spendingChangePercent={data.spendingChangePercent}
        totalFees={data.feeBreakdown.total}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MonthlyTrend data={data.monthlyTrend} />
        <SpendingByCategory data={data.spendingByCategory} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopMerchants data={data.topMerchants} />
        <FeeBreakdown data={data.feeBreakdown} />
      </div>
    </div>
  );
}
