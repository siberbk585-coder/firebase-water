/**
 * Mở PDF trong trang — tránh window.open (trên WebView/Capacitor sẽ nhảy sang Chrome ngoài).
 */

export function isRestrictedWebView(): boolean {
  if (typeof window === "undefined") return false;

  const cap = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }
  ).Capacitor;

  if (cap?.isNativePlatform?.()) return true;

  const ua = navigator.userAgent;
  // Android System WebView
  if (/Android/i.test(ua) && /\bwv\b/i.test(ua)) return true;

  return false;
}

export type OpenPdfBlobOptions = {
  fileName?: string;
  title?: string;
  /** Thử gọi print() sau khi mở (desktop). Trên WebView thường bỏ qua. */
  tryPrint?: boolean;
};

/** Hiển thị PDF full-screen trong app; không mở trình duyệt ngoài. */
export function openPdfBlob(blob: Blob, options: OpenPdfBlobOptions = {}): void {
  const fileName = options.fileName ?? "hoa-don.pdf";
  const title = options.title ?? "Hóa đơn";
  const url = URL.createObjectURL(blob);
  const restricted = isRestrictedWebView();

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;background:rgba(15,23,42,0.92);padding:var(--app-safe-top,env(safe-area-inset-top,0px)) var(--app-safe-right,env(safe-area-inset-right,0px)) var(--app-safe-bottom,env(safe-area-inset-bottom,0px)) var(--app-safe-left,env(safe-area-inset-left,0px))";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;background:#0f172a;color:#f8fafc;flex-shrink:0";

  const heading = document.createElement("span");
  heading.textContent = title;
  heading.style.cssText = "flex:1;min-width:120px;font-weight:600;font-size:14px";

  const btnStyle =
    "border:0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Đóng";
  closeBtn.style.cssText = `${btnStyle};background:#334155;color:#f8fafc`;
  closeBtn.setAttribute("aria-label", "Đóng xem hóa đơn");

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.textContent = "Tải PDF";
  downloadBtn.style.cssText = `${btnStyle};background:#0d9488;color:#fff`;

  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.textContent = "In";
  printBtn.style.cssText = `${btnStyle};background:#0369a1;color:#fff`;
  if (restricted) printBtn.style.display = "none";

  bar.append(heading, downloadBtn, printBtn, closeBtn);

  const frameWrap = document.createElement("div");
  frameWrap.style.cssText = "flex:1;min-height:0;padding:0 8px 8px";

  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.src = url;
  iframe.style.cssText =
    "width:100%;height:100%;min-height:240px;border:0;border-radius:8px;background:#fff";

  frameWrap.appendChild(iframe);
  overlay.append(bar, frameWrap);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    URL.revokeObjectURL(url);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") cleanup();
  };

  closeBtn.addEventListener("click", cleanup);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) cleanup();
  });

  downloadBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  printBtn.addEventListener("click", () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* bỏ qua */
    }
  });

  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKey);

  if (options.tryPrint && !restricted) {
    iframe.addEventListener("load", () => {
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {
          /* người dùng xem trong overlay */
        }
      }, 400);
    });
  }
}
