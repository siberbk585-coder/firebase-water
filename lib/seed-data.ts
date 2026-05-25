/** Dữ liệu mẫu tiếng Việt cho seed — tách riêng để dễ chỉnh */

export const PRICE_GROUPS = [
  { code: "A", name: "Sinh hoạt", unitPrice: 15000 },
  { code: "B", name: "Kinh doanh", unitPrice: 22000 },
] as const;

/** Khu vực thu + đơn giá VNĐ/m³ (mỗi khu vực một giá). */
export const COLLECTION_ROUTES = [
  { code: "212", name: "ĐƯỜNG 212", sortOrder: 1, unitPrice: 15_000 },
  { code: "bang-vien", name: "BẢNG VIÊN", sortOrder: 2, unitPrice: 16_000 },
  { code: "doc-hanh", name: "ĐỘC HÀNH", sortOrder: 3, unitPrice: 15_500 },
  { code: "xom-10", name: "XÓM 10", sortOrder: 4, unitPrice: 15_000 },
  { code: "dong-quy", name: "ĐÔNG QUÝ", sortOrder: 5, unitPrice: 22_000 },
  { code: "cam-khe", name: "CAM KHÊ", sortOrder: 6, unitPrice: 22_000 },
  { code: "minh-thi", name: "MINH THỊ", sortOrder: 7, unitPrice: 16_500 },
  { code: "doc-hau", name: "DỘC HẬU", sortOrder: 8, unitPrice: 15_000 },
] as const;

/** 20 hộ có tài khoản app — chưa gửi chỉ số kỳ hiện tại (test gửi CSM). */
export const TEST_RESIDENT_ACCOUNTS = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return {
    phone: `0920000${String(n).padStart(3, "0")}`,
    mkh: `TEST${String(n).padStart(3, "0")}`,
    meterCode: `TEST${String(n).padStart(5, "0")}`,
    name: `Hộ test ${n}`,
  };
});

/** Đường phố Hải Phòng (khu vực thu nước mock). */
export const STREETS = [
  "Lạch Tray",
  "Lê Lợi",
  "Trần Nguyên Hãn",
  "Tô Hiệu",
  "Đinh Tiên Hoàng",
  "Lương Khánh Thiện",
  "Nguyễn Bỉnh Khiêm",
  "Trần Phú",
  "Lê Đại Hành",
  "Đà Nẵng",
];

export const WARDS = [
  "Phường Hoàng Văn Thụ",
  "Phường Máy Chai",
  "Phường Máy Tơ",
  "Phường Cầu Tre",
  "Phường Gia Viên",
  "Phường Lạch Tray",
  "Phường Đông Khê",
  "Phường Lam Sơn",
  "Phường An Biên",
  "Phường Hàng Kênh",
];

export const DISTRICTS = [
  "Quận Hồng Bàng",
  "Quận Ngô Quyền",
  "Quận Lê Chân",
  "Quận Hải An",
  "Quận Kiến An",
  "Quận Đồ Sơn",
  "Quận Dương Kinh",
];

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng"];
const DEM = [
  "Văn An",
  "Thị Mai",
  "Minh Tuấn",
  "Thu Hà",
  "Đức Anh",
  "Thanh Hương",
  "Quốc Bảo",
  "Kim Oanh",
  "Hồng Nhung",
  "Gia Bảo",
];

export function demoResidentName(): string {
  return "Nguyễn Văn An";
}

export function adminDisplayName(): string {
  return "Ban quản lý";
}

export function randomResidentName(index: number): string {
  const ho = HO[index % HO.length];
  const dem = DEM[(index * 7) % DEM.length];
  return `${ho} ${dem}`;
}

export function randomAddress(index: number): string {
  const so = (index % 120) + 1;
  const street = STREETS[index % STREETS.length];
  const ward = WARDS[index % WARDS.length];
  const district = DISTRICTS[index % DISTRICTS.length];
  return `Số ${so}, đường ${street}, ${ward}, ${district}, Thành phố Hải Phòng`;
}
