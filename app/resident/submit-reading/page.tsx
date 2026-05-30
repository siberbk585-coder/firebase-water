import { requireResident } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { currentCalendarPeriod, getBillingPeriods } from "@/lib/billingSheet";
import { enrollHouseholdInOpenPeriods } from "@/lib/billingPeriods";
import { getOldReading, readingLastUpdatedAt } from "@/lib/readings";
import { canResidentSubmitForPeriod } from "@/lib/settings";
import { SubmitReadingClient } from "./SubmitReadingClient";
import { formatPeriod, readingStatusLabel } from "@/lib/vi";
import { ReadingStatus } from "@/lib/types/enums";;

export default async function SubmitReadingPage() {
  const user = await requireResident();
  if (!user.householdId) {
    return <p>Tài khoản chưa gắn hộ dân. Vui lòng liên hệ quản trị.</p>;
  }

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: user.householdId },
    include: { priceGroup: true },
  });

  const periods = await getBillingPeriods();
  const cal = currentCalendarPeriod();
  const currentPeriod =
    periods.find((p) => p.year === cal.year && p.month === cal.month) ??
    periods.find((p) => p.status === "OPEN") ??
    periods[0];

  if (currentPeriod?.status === "OPEN") {
    await enrollHouseholdInOpenPeriods(user.householdId);
  }

  const currentReading =
    currentPeriod && user.householdId
      ? await prisma.meterReading.findUnique({
          where: {
            householdId_periodId: {
              householdId: user.householdId,
              periodId: currentPeriod.id,
            },
          },
        })
      : null;

  const lastUpdatedAt = currentReading ? readingLastUpdatedAt(currentReading) : null;

  const submitGate = currentPeriod
    ? await canResidentSubmitForPeriod(currentPeriod)
    : { allowed: false as const, reason: "Chưa có kỳ tính cước." };

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Ghi chỉ số đồng hồ</h1>
      <div className="card mb-4">
        <p className="text-sm">
          <strong>Đồng hồ:</strong> {household.meterCode} — {household.address}
        </p>
        {currentPeriod && (
          <p className="text-sm text-slate-600">
            Kỳ hiện tại: {formatPeriod(currentPeriod.month, currentPeriod.year)}
          </p>
        )}
        {currentReading && (
          <p className="mt-2 text-sm text-slate-600">
            Trạng thái kỳ này:{" "}
            <strong>{readingStatusLabel(currentReading.status)}</strong>
            {currentReading.status === ReadingStatus.PENDING && (
              <span className="block text-[var(--muted)]">
                Đã gửi — chờ tổ trưởng/kế toán chốt chỉ số tháng này.
              </span>
            )}
            {currentReading.status === ReadingStatus.REJECTED && (
              <span className="block text-[var(--danger)]">
                Bị từ chối — vui lòng gửi lại chỉ số đúng.
              </span>
            )}
          </p>
        )}
        {lastUpdatedAt && (
          <p className="mt-1 text-sm text-slate-600">
            Cập nhật gần nhất:{" "}
            <strong>
              {lastUpdatedAt.toLocaleString("vi-VN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </strong>
            {currentReading?.confirmedValue != null && (
              <>
                {" "}
                — CSM đã gửi/chốt: <strong>{currentReading.confirmedValue}</strong>
                {currentReading.usageM3 != null && (
                  <span> (tiêu thụ {currentReading.usageM3} m³)</span>
                )}
              </>
            )}
          </p>
        )}
      </div>
      {currentPeriod ? (
        <SubmitReadingClient
          periodId={currentPeriod.id}
          oldReading={await getOldReading(user.householdId, currentPeriod.id)}
          initialCsm={
            currentReading?.confirmedValue != null
              ? String(currentReading.confirmedValue)
              : ""
          }
          canSubmit={
            submitGate.allowed &&
            (!currentReading ||
              currentReading.status === ReadingStatus.REJECTED ||
              currentReading.status === ReadingStatus.PENDING)
          }
          submitBlockedReason={!submitGate.allowed ? submitGate.reason : undefined}
        />
      ) : (
        <p>Chưa có kỳ tính cước.</p>
      )}
    </>
  );
}
