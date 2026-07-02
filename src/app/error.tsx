"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <p className="text-4xl">😥</p>
      <h1 className="text-lg font-semibold text-gray-900">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="text-sm text-text-secondary">
        ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง หากยังไม่หายกรุณาติดต่อผู้ดูแลระบบ
      </p>
      {error.digest && <p className="text-xs text-gray-400">รหัสอ้างอิง: {error.digest}</p>}
      <Button onClick={reset}>ลองใหม่</Button>
    </main>
  );
}
