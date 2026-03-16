'use client';

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import MapPicker from "@/components/MapPicker";
import UploadPreview from "@/components/UploadPreview";
import { useRouter } from "next/navigation";
import VatTuPicker from "@/components/VatTuPicker";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin, Phone, User, FileUp, Send, Info } from "lucide-react";

const STYLE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;

function parseGoogleMaps(url: string): { lat: number; lng: number } | null {
  try {
    const u = new URL(url);

    // 1) /@lat,lng
    const at = u.pathname.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/);
    if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[3]) };

    // 2) data=...!3dLAT!4dLNG...
    const full = u.href;
    const d3d4d = full.match(/!3d(-?\d+(\.\d+)?)!4d(-?\d+(\.\d+)?)/);
    if (d3d4d) return { lat: parseFloat(d3d4d[1]), lng: parseFloat(d3d4d[3]) };

    // 3) ?q=lat,lng
    const q = u.searchParams.get("q");
    if (q) {
      const m = q.match(/(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
    }

    // 4) ?ll=lat,lng
    const ll = u.searchParams.get("ll");
    if (ll) {
      const m = ll.match(/(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
    }
  } catch {}
  return null;
}

function normalizeVNPhone(raw: string) {
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  if (s.startsWith("84")) s = "0" + s.slice(2);
  s = s.replace(/\D/g, "");
  return s;
}

function isValidVNMobile(phone: string) {
  return /^(03|05|07|08|09)\d{8}$/.test(phone);
}

export default function ReportPage() {
  const router = useRouter();

  const [loai, setLoai] = useState<"cuu_nguoi" | "nhu_yeu_pham">("cuu_nguoi");
  const [ten, setTen] = useState("");
  const [sdt, setSdt] = useState("");
  const [sdtErr, setSdtErr] = useState<string | null>(null);

  const [noidung, setNoidung] = useState("");
  const [soNguoi, setSoNguoi] = useState<number>(1);
  const [soNguoiDraft, setSoNguoiDraft] = useState<string>("1");

  const [gmap, setGmap] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  const [vattuMap, setVattuMap] = useState<Record<number, number>>({});
  const vattuArr = useMemo(
    () =>
      Object.entries(vattuMap).map(([id, sl]) => ({
        vattu_id: Number(id),
        so_luong: Number(sl),
      })),
    [vattuMap]
  );

  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    const p = parseGoogleMaps(gmap);
    if (p) setPos(p);
  }, [gmap]);

  const canSubmit = useMemo(() => {
    const normalized = normalizeVNPhone(sdt);
    return (
      ten.trim().length > 0 &&
      normalized.length > 0 &&
      isValidVNMobile(normalized) &&
      noidung.trim().length > 0 &&
      !!pos &&
      !sending
    );
  }, [ten, sdt, noidung, pos, sending]);

  async function submit() {
    if (!ten.trim()) return alert("Vui lòng nhập tên người gửi.");

    const normalizedPhone = normalizeVNPhone(sdt);
    if (!normalizedPhone) return alert("Vui lòng nhập số điện thoại.");
    if (!isValidVNMobile(normalizedPhone))
      return alert("SĐT không đúng định dạng mobile VN (VD: 09xxxxxxxx hoặc +84xxxxxxxxx).");

    if (!noidung.trim()) return alert("Vui lòng nhập nội dung.");
    if (!pos) return alert("Vui lòng chọn vị trí trên bản đồ.");

    const fd = new FormData();
    fd.append("loai", loai);
    fd.append("ten_nguoigui", ten.trim());
    fd.append("sdt_nguoigui", normalizedPhone);
    fd.append("noidung", noidung.trim());
    fd.append("lat", String(pos.lat));
    fd.append("lng", String(pos.lng));
    fd.append("so_nguoi", String(soNguoi));
    fd.append("vattu_chitiet", JSON.stringify(vattuArr));
    files.forEach((f) => fd.append("files[]", f, f.name));

    setSending(true);
    try {
      const r = await fetch(`/api/yeucau`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      if (r.status === 409) {
        const j = await r.json();
        if (confirm("Số điện thoại này đã có yêu cầu đang tiếp nhận. Bạn muốn xem trạng thái yêu cầu không?")) {
          router.push(`/xemyeucau/${j.existing_id}`);
        }
        return;
      }

      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      alert("Đã gửi yêu cầu. Cảm ơn bạn!");
      router.push(`/xemyeucau/${j.id}`);
    } catch (e: any) {
      alert("Lỗi gửi yêu cầu: " + (e?.message || ""));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-6">
      {/* LEFT: FORM */}
      <Card className="order-2 lg:order-1 rounded-2xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Gửi yêu cầu cứu trợ</CardTitle>
            <Badge variant="secondary" className="rounded-full">
              {loai === "cuu_nguoi" ? "🚑 Cứu người" : "📦 Nhu yếu phẩm"}
            </Badge>
          </div>
          <CardDescription className="text-sm">
            Điền thông tin chính xác để đội hỗ trợ xử lý nhanh. Các trường có dấu * là bắt buộc.
          </CardDescription>

          {/* Segmented control */}
          <div className="inline-flex w-full rounded-xl border bg-muted p-1">
            <button
              type="button"
              onClick={() => setLoai("cuu_nguoi")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                loai === "cuu_nguoi" ? "bg-red-600 text-white shadow" : "hover:bg-white"
              }`}
            >
              🚑 Cứu người
            </button>
            <button
              type="button"
              onClick={() => setLoai("nhu_yeu_pham")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                loai === "nhu_yeu_pham" ? "bg-blue-600 text-white shadow" : "hover:bg-white"
              }`}
            >
              📦 Nhu yếu phẩm
            </button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6">
          {/* Section: vị trí từ gmap */}
          <section className="rounded-xl border p-4 bg-white">
            <div className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4" />
              Vị trí (tùy chọn)
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Nếu bạn có link Google Maps, dán vào để tự nhận tọa độ. Nếu không, chọn trực tiếp trên bản đồ bên phải.
            </p>

            <div className="mt-3 grid gap-2">
              <label className="text-sm text-gray-600">Link Google Maps</label>
              <Input
                value={gmap}
                onChange={(e) => setGmap(e.target.value)}
                placeholder="Dán link vị trí Google Maps..."
              />
              {pos && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Đã nhận tọa độ: <b>{pos.lat}</b>, <b>{pos.lng}</b>
                </div>
              )}
            </div>
          </section>

          {/* Section: người gửi */}
          <section className="rounded-xl border p-4 bg-white">
            <div className="flex items-center gap-2 font-semibold">
              <User className="h-4 w-4" />
              Thông tin người gửi
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-gray-600">Tên người gửi *</label>
                <Input
                  value={ten}
                  onChange={(e) => setTen(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-gray-600">Số điện thoại *</label>

                <div className="relative">
                  <Phone className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    className={`pl-9 ${sdtErr ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    value={sdt}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d+()\s.-]/g, "");
                      setSdt(cleaned);
                      if (sdtErr) setSdtErr(null);
                    }}
                    onBlur={() => {
                      const normalized = normalizeVNPhone(sdt);
                      if (!normalized) {
                        setSdtErr("Vui lòng nhập số điện thoại.");
                        return;
                      }
                      if (!isValidVNMobile(normalized)) {
                        setSdtErr("SĐT phải là mobile VN 10 số (03/05/07/08/09xxxxxxxx).");
                        return;
                      }
                      setSdt(normalized);
                      setSdtErr(null);
                    }}
                    inputMode="numeric"
                    placeholder="VD: 09xxxxxxxx hoặc +84xxxxxxxxx"
                    aria-invalid={!!sdtErr}
                  />
                </div>

                {sdtErr ? (
                  <div className="text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{sdtErr}</span>
                  </div>
                ) : null
                
                }
              </div>
            </div>
          </section>

          {/* Section: nội dung */}
          <section className="rounded-xl border p-4 bg-white">
            <div className="flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" />
              Nội dung yêu cầu
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-sm text-gray-600">Mô tả chi tiết *</label>
              <Textarea
                rows={5}
                value={noidung}
                onChange={(e) => setNoidung(e.target.value)}
                placeholder="VD: Nhà bị ngập ~1m, cần thuyền/áo phao, có người già và trẻ nhỏ..."
              />
              <div className="text-xs text-gray-500">
                Gợi ý: mô tả tình trạng, số người, đồ cần thiết, điểm nhận biết (cổng, biển số nhà...).
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-gray-600">Số người cần cứu</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                  value={soNguoiDraft}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d]/g, "");
                    setSoNguoiDraft(next);
                  }}
                  onBlur={() => {
                    const digits = soNguoiDraft.replace(/\D/g, "");
                    const n = digits === "" ? 1 : Math.max(1, parseInt(digits, 10));
                    setSoNguoi(n);
                    setSoNguoiDraft(String(n));
                  }}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-gray-600">Vật tư cần hỗ trợ</label>
                <VatTuPicker value={vattuMap} onChange={setVattuMap} />
              </div>
            </div>
          </section>

          {/* Section: upload */}
          <section className="rounded-xl border p-4 bg-white">
            <div className="flex items-center gap-2 font-semibold">
              <FileUp className="h-4 w-4" />
              Ảnh / video đính kèm
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ưu tiên ảnh rõ hiện trạng. Có thể tải nhiều file.
            </p>

            <div className="mt-3 grid gap-2">
              <Input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <UploadPreview files={files} setFiles={setFiles} />
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-gray-500">
              {pos ? (
                <span className="text-green-700">✅ Đã chọn vị trí trên bản đồ</span>
              ) : (
                <span className="text-red-600">⚠️ Chưa chọn vị trí</span>
              )}
            </div>

            <Button onClick={submit} disabled={!canSubmit} className="rounded-xl">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: MAP */}
      <div className="order-1 lg:order-2">
        <Card className="rounded-2xl lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Chọn vị trí trên bản đồ</CardTitle>
            <CardDescription className="text-sm">
              Click lên bản đồ để đặt điểm. Bạn có thể zoom/drag để chọn đúng vị trí.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MapPicker styleUrl={STYLE} value={pos} onChange={setPos} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
