import type { Metadata } from "next";
import { MobilePreviewMode } from "@/components/MobilePreviewMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thu tiền nước",
  description: "Ứng dụng ghi chỉ số, hóa đơn và theo dõi thu tiền nước",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <MobilePreviewMode />
        {children}
      </body>
    </html>
  );
}
