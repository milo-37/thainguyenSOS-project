import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:8000";

function cleanHeaders(headers: Headers) {
  const h = new Headers(headers);
  h.delete("host");
  h.delete("connection");
  h.delete("content-length");
  return h;
}

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const url = new URL(req.url);
  const path = ctx.params.path.join("/");
  const target = `${API_BASE}/api/${path}${url.search}`;

  const res = await fetch(target, {
    method: req.method,
    headers: cleanHeaders(req.headers),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    redirect: "manual",
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
