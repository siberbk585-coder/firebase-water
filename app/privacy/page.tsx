import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư — Thu tiền nước",
  description: "Chính sách quyền riêng tư ứng dụng Thu tiền nước cho nhân viên HTX",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-800">
      <p className="mb-6 text-sm text-slate-500">
        <Link href="/login" className="text-blue-700 hover:underline">
          ← Về trang đăng nhập
        </Link>
      </p>

      <h1 className="mb-2 text-2xl font-bold">Chính sách quyền riêng tư</h1>
      <p className="mb-8 text-sm text-slate-600">
        Ứng dụng <strong>Thu tiền nước</strong> (Android) và hệ thống{" "}
        <strong>tiennuoc.web.app</strong>
        <br />
        Cập nhật: tháng 6/2026
      </p>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Phạm vi</h2>
        <p>
          Ứng dụng dành cho <strong>nhân viên nội bộ</strong> (quản trị, thu hộ) của
          hợp tác xã / nhà máy nước vận hành hệ thống. Không phải ứng dụng dành cho
          khách hàng cuối trên cửa hàng ứng dụng công khai.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">2. Dữ liệu thu thập</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Tài khoản nhân viên:</strong> số điện thoại đăng nhập, họ tên, vai
            trò (admin / thu hộ).
          </li>
          <li>
            <strong>Dữ liệu nghiệp vụ:</strong> thông tin hộ sử dụng nước (mã hộ, tên,
            địa chỉ, chỉ số đồng hồ, hóa đơn, số tiền) — phục vụ thu tiền nước theo
            quy trình vận hành.
          </li>
          <li>
            <strong>Thiết bị:</strong> token phiên đăng nhập lưu an toàn trên máy; kết
            nối Bluetooth khi in hóa đơn nhiệt.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">3. Quyền ứng dụng Android</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Internet:</strong> đồng bộ dữ liệu với máy chủ{" "}
            <code className="rounded bg-slate-100 px-1">tiennuoc.web.app</code>.
          </li>
          <li>
            <strong>Bluetooth:</strong> kết nối máy in nhiệt ESC/POS để in biên nhận.
            Trên Android 12 trở lên, quyền quét Bluetooth được khai báo{" "}
            <em>không dùng để suy ra vị trí</em> (neverForLocation).
          </li>
          <li>
            <strong>Vị trí (một số máy Android 6–11):</strong> hệ điều hành có thể yêu
            cầu khi quét thiết bị Bluetooth; ứng dụng không thu thập hay theo dõi vị
            trí GPS.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">4. Lưu trữ và bảo mật</h2>
        <p>
          Dữ liệu nghiệp vụ lưu trên máy chủ đám mây (Google Cloud / Firebase), cơ sở dữ
          liệu PostgreSQL. Token đăng nhập trên thiết bị được lưu bằng cơ chế secure
          storage của hệ điều hành. Truyền tải qua HTTPS.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">5. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi <strong>không bán</strong> dữ liệu cho bên thứ ba. Dữ liệu chỉ
          dùng trong phạm vi vận hành thu tiền nước của đơn vị quản lý và nhân viên được
          phân quyền.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">6. Xóa tài khoản và yêu cầu quyền riêng tư</h2>
        <p>
          Tài khoản nhân viên do quản trị HTX tạo. Để yêu cầu xóa tài khoản hoặc truy
          cập / chỉnh sửa dữ liệu cá nhân, vui lòng liên hệ quản trị hệ thống của đơn
          vị vận hành.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">7. Liên hệ</h2>
        <p>
          Mọi thắc mắc về chính sách này, liên hệ bộ phận quản trị HTX / nhà máy nước
          qua kênh nội bộ đã được cấp cho nhân viên.
        </p>
      </section>
    </main>
  );
}
