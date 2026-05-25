import { NextResponse } from "next/server";
import { z } from "zod";
import { uploadImageBuffer } from "@/lib/imageUpload";

export const runtime = "nodejs";

function checkApiKey(request: Request): boolean {
  const expected = process.env.UPLOAD_API_KEY?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const headerKey = request.headers.get("x-api-key");
  return bearer === expected || headerKey === expected;
}

const jsonSchema = z.object({
  image_base64: z.string().min(1),
  filename: z.string().optional(),
  content_type: z.string().optional(),
});

export async function POST(request: Request) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    let buffer: Buffer;
    let mime = "image/jpeg";
    let filename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image") ?? form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Thiếu file image hoặc file" }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      mime = file.type || mime;
      filename = file.name;
    } else {
      const body = await request.json();
      const parsed = jsonSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
      }
      const raw = parsed.data.image_base64.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(raw, "base64");
      mime = parsed.data.content_type ?? mime;
      filename = parsed.data.filename;
    }

    if (!buffer.length) {
      return NextResponse.json({ error: "Ảnh rỗng" }, { status: 400 });
    }

    const result = await uploadImageBuffer(buffer, {
      filename,
      contentType: mime,
    });
    // Khi dùng n8n webhook, url do workflow n8n trả về

    return NextResponse.json({
      ok: true,
      url: result.url,
      pathname: result.pathname,
      storage: result.storage,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
