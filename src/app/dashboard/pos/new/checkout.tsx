"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/client";
import { createTransaction, type CheckoutLineItemInput } from "../actions";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export type PrefillLineItem = {
  serviceOptionId: string;
  serviceName: string;
  durationMinutes: number;
  price: string;
  promoPrice: string | null;
  therapistId: string | null;
  therapistNickname: string | null;
};

export type CustomerPackage = {
  id: string;
  name: string;
  serviceId: string | null;
  remainingSessions: number;
};

type ServiceOption = { id: string; durationMinutes: number; price: string; promoPrice: string | null };
type Service = { id: string; name: string; options: ServiceOption[] };
type Therapist = { id: string; nickname: string };

type LineItem = {
  key: string;
  serviceId: string;
  serviceOptionId: string;
  therapistId: string;
  quantity: number;
  /// "" = pay with the selected payment method below; otherwise the id of the Package to redeem.
  packageId: string;
};

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: "เงินสด" },
  { value: "TRANSFER", label: "โอนเงิน" },
  { value: "PROMPTPAY", label: "พร้อมเพย์" },
  { value: "CARD", label: "บัตร" },
];

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

export function Checkout({
  branchId,
  queueId,
  prefillItem,
  customerPackages,
}: {
  branchId: string;
  queueId?: string;
  prefillItem?: PrefillLineItem;
  customerPackages: CustomerPackage[];
}) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [therapistsByService, setTherapistsByService] = useState<Record<string, Therapist[]>>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: { services: Service[] }) => setServices(data.services));
  }, []);

  // Initialize the first line item from the prefilled queue, once the services list is loaded
  // (needed to know which Service the prefilled ServiceOption belongs to).
  useEffect(() => {
    if (services.length === 0 || items.length > 0 || !prefillItem) return;
    const parentService = services.find((s) => s.options.some((o) => o.id === prefillItem.serviceOptionId));
    if (!parentService) return;
    setItems([
      {
        key: nextKey(),
        serviceId: parentService.id,
        serviceOptionId: prefillItem.serviceOptionId,
        therapistId: prefillItem.therapistId ?? "",
        quantity: 1,
        packageId: "",
      },
    ]);
    loadTherapists(parentService.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, prefillItem, items.length]);

  function loadTherapists(serviceId: string) {
    if (therapistsByService[serviceId]) return;
    fetch(`/api/therapists?branchId=${branchId}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data: { therapists: Therapist[] }) =>
        setTherapistsByService((prev) => ({ ...prev, [serviceId]: data.therapists }))
      );
  }

  function addLineItem() {
    setItems((rows) => [
      ...rows,
      { key: nextKey(), serviceId: "", serviceOptionId: "", therapistId: "", quantity: 1, packageId: "" },
    ]);
  }

  function removeLineItem(key: string) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }

  function updateLineItem(key: string, patch: Partial<LineItem>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function findOption(serviceId: string, serviceOptionId: string): ServiceOption | undefined {
    return services.find((s) => s.id === serviceId)?.options.find((o) => o.id === serviceOptionId);
  }

  function eligiblePackages(serviceId: string): CustomerPackage[] {
    return customerPackages.filter((p) => !p.serviceId || p.serviceId === serviceId);
  }

  const { subtotal, vatAmount, totalAmount } = useMemo(() => {
    const sub = items.reduce((sum, item) => {
      if (item.packageId) return sum; // paid for via the package already, ฿0 charged today
      const option = findOption(item.serviceId, item.serviceOptionId);
      if (!option) return sum;
      const unitPrice = Number(option.promoPrice ?? option.price);
      return sum + unitPrice * item.quantity;
    }, 0);
    const discount = Number(discountAmount || "0") || 0;
    const total = Math.max(0, sub - discount);
    const vat = Math.round(((total * 7) / 107) * 100) / 100;
    return { subtotal: sub, vatAmount: vat, totalAmount: total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, discountAmount, services]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
      return;
    }
    if (items.some((i) => !i.serviceOptionId || !i.therapistId)) {
      setError("กรุณาเลือกบริการและหมอนวดให้ครบทุกรายการ");
      return;
    }

    setIsSubmitting(true);
    const payloadItems: CheckoutLineItemInput[] = items.map((i) => ({
      serviceOptionId: i.serviceOptionId,
      therapistId: i.therapistId,
      quantity: i.quantity,
      packageId: i.packageId || null,
    }));

    const result = await createTransaction({
      branchId,
      queueId,
      paymentMethod,
      discountAmount,
      items: payloadItems,
    });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/dashboard/pos/receipt/${result.data.transactionId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const service = services.find((s) => s.id === item.serviceId);
          const option = findOption(item.serviceId, item.serviceOptionId);
          const therapists = therapistsByService[item.serviceId] ?? [];
          const packages = item.serviceId ? eligiblePackages(item.serviceId) : [];

          return (
            <div key={item.key} className="flex flex-col gap-2.5 rounded-xl border border-border p-3.5 text-sm">
              <Select
                value={item.serviceId}
                onChange={(e) => {
                  const serviceId = e.target.value;
                  updateLineItem(item.key, { serviceId, serviceOptionId: "", therapistId: "", packageId: "" });
                  if (serviceId) loadTherapists(serviceId);
                }}
              >
                <option value="">เลือกบริการ</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>

              {service && (
                <Select
                  value={item.serviceOptionId}
                  onChange={(e) => updateLineItem(item.key, { serviceOptionId: e.target.value })}
                >
                  <option value="">เลือกระยะเวลา</option>
                  {service.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.durationMinutes} นาที ({o.promoPrice ? `฿${o.promoPrice} ปกติ ฿${o.price}` : `฿${o.price}`})
                    </option>
                  ))}
                </Select>
              )}

              {item.serviceId && (
                <Select
                  value={item.therapistId}
                  onChange={(e) => updateLineItem(item.key, { therapistId: e.target.value })}
                >
                  <option value="">เลือกหมอนวด</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nickname}
                    </option>
                  ))}
                </Select>
              )}

              {packages.length > 0 && (
                <Select
                  value={item.packageId}
                  onChange={(e) => updateLineItem(item.key, { packageId: e.target.value })}
                >
                  <option value="">ชำระด้วยเงิน/โอน/บัตร</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      ใช้คอร์ส: {p.name} (เหลือ {p.remainingSessions} ครั้ง)
                    </option>
                  ))}
                </Select>
              )}

              {option && (
                <p className="font-medium text-text-secondary">
                  {item.packageId
                    ? "฿0 (ตัดจากคอร์ส)"
                    : `รวม: ฿${Number(option.promoPrice ?? option.price) * item.quantity}`}
                </p>
              )}

              <button
                type="button"
                onClick={() => removeLineItem(item.key)}
                className="self-start text-xs font-medium text-danger hover:text-danger-hover"
              >
                ลบรายการนี้
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addLineItem}
          className="self-start rounded-xl border border-dashed border-border px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light"
        >
          + เพิ่มรายการ
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
        ส่วนลด (บาท)
        <input
          type="number"
          min={0}
          step="0.01"
          value={discountAmount}
          onChange={(e) => setDiscountAmount(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
        วิธีชำระเงิน
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </label>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-gray-50/60 p-3.5 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">ยอดรวม</span>
          <span className="text-gray-900">฿{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">ยอดสุทธิ (รวม VAT {vatAmount.toFixed(2)} บาท)</span>
          <span className="text-base font-semibold text-gray-900">฿{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
        รับชำระเงิน
      </Button>
    </form>
  );
}
