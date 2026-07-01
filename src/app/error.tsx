"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-4xl">😥</p>
      <h1 className="text-lg font-semibold">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="text-sm text-neutral-500">
        ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง หากยังไม่หายกรุณาติดต่อผู้ดูแลระบบ
      </p>
      {error.digest && <p className="text-xs text-neutral-400">รหัสอ้างอิง: {error.digest}</p>}
      <button
        onClick={reset}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        ลองใหม่
      </button>
    </main>
  );
}
