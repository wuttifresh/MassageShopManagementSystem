"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BOOKING_CHANNEL_KEYS, type BookingChannelKey } from "@/lib/booking-channel";

type Branch = { id: string; name: string };

const CHANNEL_LABEL: Record<BookingChannelKey, string> = {
  LINE: "LINE",
  WHATSAPP: "WhatsApp",
  ONLINE: "เว็บไซต์",
  WALK_IN: "หน้าร้าน",
  PHONE: "โทรศัพท์",
  ADMIN: "แอดมิน",
};

export function BookingFilterForm({
  branches,
  activeBranchId,
  startDate,
  endDate,
  channel,
  showBranchPicker,
}: {
  branches: Branch[];
  activeBranchId: string;
  startDate: string;
  endDate: string;
  channel: BookingChannelKey | null;
  showBranchPicker: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(activeBranchId);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [selectedChannel, setSelectedChannel] = useState(channel ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ branchId, startDate: start, endDate: end });
    if (selectedChannel) params.set("channel", selectedChannel);
    router.push(`/dashboard/bookings?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      {showBranchPicker && (
        <Field label="สาขา" className="col-span-2 sm:w-48">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="ตั้งแต่วันที่" className="sm:w-44">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="ถึงวันที่" className="sm:w-44">
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="ช่องทาง" className="col-span-2 sm:w-44">
        <Select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
          <option value="">ทุกช่องทาง</option>
          {BOOKING_CHANNEL_KEYS.map((key) => (
            <option key={key} value={key}>
              {CHANNEL_LABEL[key]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="col-span-2 sm:col-span-1">
        กรอง
      </Button>
    </form>
  );
}
