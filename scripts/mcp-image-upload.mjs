#!/usr/bin/env node
/**
 * MCP server: upload ảnh → trả URL (cho n8n MCP Client node).
 *
 * Chạy:
 *   FIREBASE_WATER_API_URL=https://tiennuoc.web.app \
 *   UPLOAD_API_KEY=your-secret \
 *   node scripts/mcp-image-upload.mjs
 *
 * n8n: MCP Client → Command: node → Args: scripts/mcp-image-upload.mjs
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = (process.env.FIREBASE_WATER_API_URL || "http://localhost:3001").replace(/\/$/, "");
const API_KEY = process.env.UPLOAD_API_KEY || "";

async function postImage(body) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const server = new McpServer({
  name: "firebase-water-image-upload",
  version: "1.0.0",
});

server.tool(
  "upload_image",
  "Upload ảnh (base64) lên storage và trả URL công khai",
  {
    image_base64: z.string().describe("Ảnh base64 hoặc data URL data:image/...;base64,..."),
    filename: z.string().optional().describe("Tên file gợi ý, vd meter.jpg"),
    content_type: z.string().optional().describe("MIME, mặc định image/jpeg"),
  },
  async ({ image_base64, filename, content_type }) => {
    const data = await postImage({ image_base64, filename, content_type });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              url: data.url,
              pathname: data.pathname,
              storage: data.storage,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "upload_image_from_url",
  "Tải ảnh từ URL rồi upload lên storage và trả URL mới",
  {
    image_url: z.string().url().describe("URL ảnh nguồn"),
    filename: z.string().optional(),
  },
  async ({ image_url, filename }) => {
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) throw new Error(`Không tải được ảnh: HTTP ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const content_type = imgRes.headers.get("content-type") || "image/jpeg";
    const data = await postImage({
      image_base64: buf.toString("base64"),
      filename,
      content_type,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ok: true, url: data.url, pathname: data.pathname, storage: data.storage },
            null,
            2
          ),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
