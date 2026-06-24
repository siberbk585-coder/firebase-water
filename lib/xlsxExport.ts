import type { InputMethod, ReadingStatus } from "@/lib/types/enums";
import * as XLSX from "xlsx-js-style";
import { parseAnomalyFlags } from "./anomaly";
import { loadBillingSheetRows, getCollectionRoutes } from "./billingSheet";
import { prisma } from "./db";
import { formatDateTimeVN } from "./datetime";
import {
  anomalyLabel,
  auditActionLabel,
  entityLabel,
  formatPeriod,
  inputMethodLabel,
  invoiceStatusLabel,
  paymentMethodLabel,
  readingStatusLabel,
} from "./vi";

function sheetFromRows<T extends Record<string, unknown>>(rows: T[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows);
}

const editableFill = {
  patternType: "solid",
  fgColor: { rgb: "FFF2CC" },
};

const headerFill = {
  patternType: "solid",
  fgColor: { rgb: "DFF7F1" },
};

function applyHeaderStyle(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref] = ws[ref] ?? { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: true },
      fill: headerFill,
      alignment: { horizontal: "center", vertical: "center" },
    };
  }
}

function highlightEditableColumns(ws: XLSX.WorkSheet, headers: string[]) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const editableHeaders = new Set(["CSM", "Đã thu (TT)"]);
  for (const header of editableHeaders) {
    const col = headers.indexOf(header);
    if (col === -1) continue;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: col });
      ws[ref] = ws[ref] ?? { t: "s", v: "" };
      ws[ref].s = {
        ...(ws[ref].s ?? {}),
        fill: editableFill,
        ...(r === 0 ? { font: { bold: true } } : {}),
      };
    }
  }
}

function formatDate(d: Date | null | undefined): string {
  return formatDateTimeVN(d);
}

export async function buildFullExportWorkbook(): Promise<XLSX.WorkBook> {
  const [
    households,
    periods,
    readings,
    invoices,
    payments,
    auditLogs,
    householdCount,
    pendingReadings,
    issuedInvoices,
    paidInvoices,
  ] = await Promise.all([
    prisma.household.findMany({
      orderBy: { householdCode: "asc" },
      include: { priceGroup: true, user: true },
    }),
    prisma.billingPeriod.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] }),
    prisma.meterReading.findMany({
      orderBy: { submittedAt: "desc" },
      include: { household: true, period: true },
    }),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { household: true, period: true, payment: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { invoice: { include: { household: true, period: true } }, confirmedBy: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { actor: true },
    }),
    prisma.household.count(),
    prisma.meterReading.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({ where: { status: "ISSUED" } }),
    prisma.invoice.count({ where: { status: "PAID" } }),
  ]);

  const totalRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === "ISSUED")
    .reduce((s, i) => s + i.totalAmount, 0);

  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { "Chỉ tiêu": "Tổng số hộ dân", "Giá trị": householdCount },
    { "Chỉ tiêu": "Chỉ số chờ duyệt", "Giá trị": pendingReadings },
    { "Chỉ tiêu": "Hóa đơn chưa thanh toán", "Giá trị": issuedInvoices },
    { "Chỉ tiêu": "Hóa đơn đã thanh toán", "Giá trị": paidInvoices },
    { "Chỉ tiêu": "Tổng tiền đã thu (VND)", "Giá trị": totalRevenue },
    { "Chỉ tiêu": "Tổng tiền chưa thu (VND)", "Giá trị": totalOutstanding },
    { "Chỉ tiêu": "Ngày xuất file", "Giá trị": formatDateTimeVN(new Date()) },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(summaryRows), "Tong_quan");

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      households.map((h) => ({
        "Mã hộ": h.householdCode,
        "Mã đồng hồ": h.meterCode,
        "Tên hộ dân": h.residentName,
        "Địa chỉ": h.address,
        "Nhóm giá": h.priceGroup.name,
        "Đơn giá (VND/m³)": h.priceGroup.unitPrice,
        "Số điện thoại": h.user?.phone ?? "",
        "Ngày tạo": formatDate(h.createdAt),
      }))
    ),
    "Ho_dan"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      periods.map((p) => ({
        "Kỳ": formatPeriod(p.month, p.year),
        "Năm": p.year,
        "Tháng": p.month,
        "Trạng thái": p.status === "OPEN" ? "Đang mở" : "Đã đóng",
        "Ngày tạo": formatDate(p.createdAt),
      }))
    ),
    "Ky_ghi"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      readings.map((r) => {
        const flags = parseAnomalyFlags(r.anomalyFlags).map(anomalyLabel);
        return {
          "Mã hộ": r.household.householdCode,
          "Mã đồng hồ": r.household.meterCode,
          "Tên hộ dân": r.household.residentName,
          "Kỳ": formatPeriod(r.period.month, r.period.year),
          "Chỉ số cũ": r.oldReading,
          "OCR": r.ocrValue ?? "",
          "Chỉ số xác nhận": r.confirmedValue ?? "",
          "Tiêu thụ (m³)": r.usageM3 ?? "",
          "Độ tin cậy (%)": r.confidence ?? "",
          "Cách nhập": r.inputMethod ? inputMethodLabel(r.inputMethod as InputMethod) : "",
          "Cảnh báo": flags.join("; "),
          "Trạng thái": readingStatusLabel(r.status as ReadingStatus),
          "Ngày gửi": formatDate(r.submittedAt),
          "Ngày xác nhận": formatDate(r.confirmedAt),
          "Link ảnh": r.imagePath ?? "",
        };
      })
    ),
    "Chi_so"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      invoices.map((inv) => ({
        "Mã hộ": inv.household.householdCode,
        "Mã đồng hồ": inv.household.meterCode,
        "Tên hộ dân": inv.household.residentName,
        "Kỳ": formatPeriod(inv.period.month, inv.period.year),
        "Tiêu thụ (m³)": inv.usageM3,
        "Đơn giá": inv.unitPrice,
        "Tổng tiền (VND)": inv.totalAmount,
        "Trạng thái": invoiceStatusLabel(inv.status),
        "Có PDF": inv.pdfPath ? "Có" : "Không",
        "Ngày phát hành": formatDate(inv.issuedAt),
        "Đã gửi Zalo": formatDate(inv.zaloSentAt),
        "Đã thu": inv.payment ? "Có" : "Chưa",
        "Ngày tạo": formatDate(inv.createdAt),
      }))
    ),
    "Hoa_don"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      payments.map((p) => ({
        "Mã hộ": p.invoice.household.householdCode,
        "Mã đồng hồ": p.invoice.household.meterCode,
        "Kỳ": formatPeriod(p.invoice.period.month, p.invoice.period.year),
        "Số tiền (VND)": p.amount,
        "Phương thức": paymentMethodLabel(p.method),
        "Ghi chú": p.note ?? "",
        "Người xác nhận": p.confirmedBy?.name ?? "",
        "Ngày xác nhận": formatDate(p.confirmedAt),
        "Ngày tạo": formatDate(p.createdAt),
      }))
    ),
    "Thanh_toan"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      auditLogs.map((log) => ({
        "Thao tác": auditActionLabel(log.action),
        "Đối tượng": entityLabel(log.entity),
        "Người thực hiện": log.actor?.name ?? "",
        "Thời gian": formatDate(log.createdAt),
      }))
    ),
    "Nhat_ky"
  );

  return wb;
}

export async function buildFullExportBuffer(): Promise<Buffer> {
  const wb = await buildFullExportWorkbook();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
  return buf;
}

export function exportFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `bao-cao-tong-hop-${y}${m}${day}.xlsx`;
}

function sheetNameSafe(name: string): string {
  const s = name.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
  return s || "Sheet";
}

function formulaSheetRef(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function formulaRange(sheetName: string, col: string, rowCount: number): string {
  const end = Math.max(2, rowCount + 1);
  return `${formulaSheetRef(sheetName)}!${col}2:${col}${end}`;
}

function setFormula(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  formula: string,
  style?: XLSX.CellObject["s"],
  numFmt?: string
) {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  ws[ref] = {
    t: "n",
    v: 0,
    f: formula,
    ...(numFmt ? { z: numFmt } : {}),
    ...(style ? { s: style } : {}),
  };
}

/** Workbook giống Excel vận hành: mỗi tuyến một sheet + TỔNG HỢP. */
export async function buildPeriodRouteWorkbook(periodId: string): Promise<XLSX.WorkBook> {
  const period = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const routes = await getCollectionRoutes();
  const wb = XLSX.utils.book_new();
  const periodTitle = `${period.month}/${period.year}`;
  const editableHeaders = [
    "STT",
    "Họ và tên",
    "SĐT",
    "MKH",
    "Khu vực",
    "Giá (đ/m³)",
    "CSC",
    "CSM",
    "Trạng thái duyệt",
    "Link ảnh",
    "Tiêu thụ (m³)",
    "Tiền (VND)",
    "Đã thu (TT)",
    "Hình thức TT",
  ];

  const guide = sheetFromRows([
    {
      "Cách dùng": "Chỉ sửa các cột bôi vàng",
      "Cột được sửa": "CSM",
      "Giá trị hợp lệ": "Số chỉ số mới, lớn hơn hoặc bằng CSC",
    },
    {
      "Cách dùng": "Chỉ sửa các cột bôi vàng",
      "Cột được sửa": "Đã thu (TT)",
      "Giá trị hợp lệ": "Nhập Đã thu, da thu, x, yes hoặc 1 để đánh dấu đã thanh toán",
    },
    {
      "Cách dùng": "Chỉ sửa các cột bôi vàng",
      "Cột được sửa": "Hình thức TT",
      "Giá trị hợp lệ": "Tiền mặt / TM / cash  →  thu tiền mặt;  Chuyển khoản / CK / bank  →  chuyển khoản (mặc định nếu để trống)",
    },
    {
      "Cách dùng": "Không đổi MKH, CSC, tên hộ, tiền hoặc tên sheet",
      "Cột được sửa": "",
      "Giá trị hợp lệ": "Upload lại file tại trang Excel hoặc Bảng thu nước",
    },
  ]);
  applyHeaderStyle(guide);
  XLSX.utils.book_append_sheet(wb, guide, "HUONG DAN");

  const routeSheets =
    routes.length > 0
      ? routes.map((route) => ({ id: route.id as string | null, name: route.name }))
      : [{ id: null, name: "TAT CA" }];
  const routeSheetMetas: { routeName: string; sheetName: string; rowCount: number }[] = [];

  for (const route of routeSheets) {
    const rows = await loadBillingSheetRows(periodId, route.id);
    const sheetRows = rows.map((r, i) => ({
      STT: r.routeSortOrder ?? i + 1,
      "Họ và tên": r.residentName,
      SĐT: r.contactPhone ?? "",
      MKH: r.householdCode,
      "Khu vực": r.routeName ?? "",
      "Giá (đ/m³)": r.unitPrice,
      CSC: r.oldReading,
      CSM: r.csm ?? "",
      "Trạng thái duyệt": r.status ? readingStatusLabel(r.status) : "",
      "Link ảnh": r.imagePath ?? "",
      "Tiêu thụ (m³)":
        r.usageM3 ?? (r.csm != null ? Math.max(0, (r.csm ?? 0) - r.oldReading) : ""),
      "Tiền (VND)":
        r.totalAmount != null && r.totalAmount > 0
          ? r.totalAmount
          : r.usageM3 === 0
            ? 0
            : "",
      "Đã thu (TT)": r.paid ? "Đã thu" : r.invoiceId ? "Chưa" : "",
      "Hình thức TT": r.paymentMethod ? paymentMethodLabel(r.paymentMethod) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows, { header: editableHeaders });
    applyHeaderStyle(ws);
    highlightEditableColumns(ws, editableHeaders);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
    ];
    const sheetName = sheetNameSafe(`${route.name} (${periodTitle})`);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    routeSheetMetas.push({ routeName: route.name, sheetName, rowCount: rows.length });
  }

  const summaryHeaders = [
    "Tuyến",
    "Sheet nguồn",
    "Số hộ",
    "Đã ghi CSM",
    "Chưa ghi",
    "Chờ chốt",
    "Đã xác nhận",
    "Từ chối",
    "Tổng m³",
    "Tổng tiền",
    "Đã thu",
    "Chưa thu",
    "Tiền đã thu",
    "Tiền chưa thu",
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet([
    [`Tổng hợp kỳ ${formatPeriod(period.month, period.year)}`],
    ["Các chỉ tiêu dùng công thức tham chiếu các sheet tuyến trong workbook."],
    [],
    summaryHeaders,
    ...routeSheetMetas.map((route) => [route.routeName, route.sheetName]),
    ["Tổng cộng"],
  ]);
  summaryWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: summaryHeaders.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: summaryHeaders.length - 1 } },
  ];
  summaryWs["!cols"] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
  ];
  summaryWs.A1.s = {
    font: { bold: true, sz: 14 },
    fill: headerFill,
    alignment: { horizontal: "center", vertical: "center" },
  };
  summaryWs.A2.s = { font: { italic: true, color: { rgb: "64748B" } } };
  for (let c = 0; c < summaryHeaders.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c });
    summaryWs[ref] = summaryWs[ref] ?? { t: "s", v: "" };
    summaryWs[ref].s = {
      font: { bold: true },
      fill: headerFill,
      alignment: { horizontal: "center", vertical: "center" },
    };
  }
  const numberStyle = { alignment: { horizontal: "right" } };
  const countFormat = "#,##0";
  const moneyFormat = "#,##0 [$₫-vi-VN]";
  routeSheetMetas.forEach((route, index) => {
    const row = 4 + index;
    const excelRow = row + 1;
    const households = formulaRange(route.sheetName, "D", route.rowCount);
    const csm = formulaRange(route.sheetName, "H", route.rowCount);
    const status = formulaRange(route.sheetName, "I", route.rowCount);
    const usage = formulaRange(route.sheetName, "K", route.rowCount);
    const amount = formulaRange(route.sheetName, "L", route.rowCount);
    const paid = formulaRange(route.sheetName, "M", route.rowCount);
    setFormula(summaryWs, row, 2, `COUNTA(${households})`, numberStyle, countFormat);
    setFormula(summaryWs, row, 3, `COUNT(${csm})`, numberStyle, countFormat);
    setFormula(summaryWs, row, 4, `C${excelRow}-D${excelRow}`, numberStyle, countFormat);
    setFormula(summaryWs, row, 5, `COUNTIF(${status},"Chờ xử lý")`, numberStyle, countFormat);
    setFormula(summaryWs, row, 6, `COUNTIF(${status},"Đã xác nhận")`, numberStyle, countFormat);
    setFormula(summaryWs, row, 7, `COUNTIF(${status},"Từ chối")`, numberStyle, countFormat);
    setFormula(summaryWs, row, 8, `SUM(${usage})`, numberStyle, countFormat);
    setFormula(summaryWs, row, 9, `SUM(${amount})`, numberStyle, moneyFormat);
    setFormula(summaryWs, row, 10, `COUNTIF(${paid},"Đã thu")`, numberStyle, countFormat);
    setFormula(summaryWs, row, 11, `COUNTIF(${paid},"Chưa")`, numberStyle, countFormat);
    setFormula(summaryWs, row, 12, `SUMIF(${paid},"Đã thu",${amount})`, numberStyle, moneyFormat);
    setFormula(summaryWs, row, 13, `SUMIF(${paid},"Chưa",${amount})`, numberStyle, moneyFormat);
  });
  const totalRow = 4 + routeSheetMetas.length;
  const firstRouteRow = 5;
  const lastRouteRow = Math.max(firstRouteRow, totalRow);
  for (let c = 2; c < summaryHeaders.length; c++) {
    const col = XLSX.utils.encode_col(c);
    const numFmt = c === 9 || c === 12 || c === 13 ? moneyFormat : countFormat;
    setFormula(summaryWs, totalRow, c, `SUM(${col}${firstRouteRow}:${col}${lastRouteRow})`, {
      font: { bold: true },
      fill: editableFill,
      alignment: { horizontal: "right" },
    }, numFmt);
  }
  summaryWs.A1.s = { ...(summaryWs.A1.s ?? {}), font: { bold: true, sz: 14 } };
  summaryWs.A2.s = { ...(summaryWs.A2.s ?? {}), font: { italic: true, color: { rgb: "64748B" } } };
  const totalLabelRef = XLSX.utils.encode_cell({ r: totalRow, c: 0 });
  summaryWs[totalLabelRef].s = { font: { bold: true }, fill: editableFill };
  summaryWs["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRow, c: summaryHeaders.length - 1 },
  });
  XLSX.utils.book_append_sheet(wb, summaryWs, "Tổng hợp");
  wb.SheetNames = ["HUONG DAN", "Tổng hợp", ...routeSheetMetas.map((r) => r.sheetName)];
  const workbookMeta = (wb.Workbook ??= {}) as Record<string, unknown>;
  workbookMeta.CalcPr = { fullCalcOnLoad: "1" };

  return wb;
}

export async function buildPeriodRouteExportBuffer(periodId: string): Promise<Buffer> {
  const wb = await buildPeriodRouteWorkbook(periodId);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
}

export function periodExportFilename(
  month: number,
  year: number,
  exportedAt: Date = new Date()
): string {
  const m = String(month).padStart(2, "0");
  const ey = exportedAt.getFullYear();
  const em = String(exportedAt.getMonth() + 1).padStart(2, "0");
  const ed = String(exportedAt.getDate()).padStart(2, "0");
  const eh = String(exportedAt.getHours()).padStart(2, "0");
  const emin = String(exportedAt.getMinutes()).padStart(2, "0");
  const esec = String(exportedAt.getSeconds()).padStart(2, "0");
  return `nuoc-thang-${m}-${year}-xuat-${ey}${em}${ed}-${eh}${emin}${esec}.xlsx`;
}
