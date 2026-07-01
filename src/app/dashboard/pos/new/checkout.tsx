"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/client";
import { createTransaction, type CheckoutLineItemInput } from "../actions";

export type PrefillLineItem = {
  serviceOptionId: string;
  serviceName: string;
  durationMinutes: number;
  price: string;
  promoPrice: string | null;
  therapistId: string | null;
  therapistNickname: string | null;
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
}: {
  branchId: string;
  queueId?: string;
  prefillItem?: PrefillLineItem;
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
    setItems((rows) => [...rows, { key: nextKey(), serviceId: "", serviceOptionId: "", therapistId: "", quantity: 1 }]);
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

  const { subtotal, vatAmount, totalAmount } = useMemo(() => {
    const sub = items.reduce((sum, item) => {
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
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const service = services.find((s) => s.id === item.serviceId);
          const option = findOption(item.serviceId, item.serviceOptionId);
          const therapists = therapistsByService[item.serviceId] ?? [];

          return (
            <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
              <select
                value={item.serviceId}
                onChange={(e) => {
                  const serviceId = e.target.value;
                  updateLineItem(item.key, { serviceId, serviceOptionId: "", therapistId: "" });
                  if (serviceId) loadTherapists(serviceId);
                }}
                className="rounded-lg border border-neutral-300 p-2"
              >
                <option value="">เลือกบริการ</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {service && (
                <select
                  value={item.serviceOptionId}
                  onChange={(e) => updateLineItem(item.key, { serviceOptionId: e.target.value })}
                  className="rounded-lg border border-neutral-300 p-2"
                >
                  <option value="">เลือกระยะเวลา</option>
                  {service.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.durationMinutes} นาที ({o.promoPrice ? `฿${o.promoPrice} ปกติ ฿${o.price}` : `฿${o.price}`})
                    </option>
                  ))}
                </select>
              )}

              {item.serviceId && (
                <select
                  value={item.therapistId}
                  onChange={(e) => updateLineItem(item.key, { therapistId: e.target.value })}
                  className="rounded-lg border border-neutral-300 p-2"
                >
                  <option value="">เลือกหมอนวด</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nickname}
                    </option>
                  ))}
                </select>
              )}

              {option && (
                <p className="text-neutral-500">
                  รวม: ฿{Number(option.promoPrice ?? option.price) * item.quantity}
                </p>
              )}

              <button
                type="button"
                onClick={() => removeLineItem(item.key)}
                className="self-start text-xs text-red-500"
              >
                ลบรายการนี้
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addLineItem}
          className="self-start rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          + เพิ่มรายการ
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        ส่วนลด (บาท)
        <input
          type="number"
          min={0}
          step="0.01"
          value={discountAmount}
          onChange={(e) => setDiscountAmount(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        วิธีชำระเงิน
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="rounded-lg border border-neutral-300 p-2"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">ยอดรวม</span>
          <span>฿{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">ยอดสุทธิ (รวม VAT {vatAmount.toFixed(2)} บาท)</span>
          <span className="font-medium">฿{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "กำลังบันทึก..." : "รับชำระเงิน"}
      </button>
    </form>
  );
}
