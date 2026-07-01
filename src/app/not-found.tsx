import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-lg font-semibold">ไม่พบหน้านี้</h1>
      <p className="text-sm text-neutral-500">หน้าที่คุณกำลังหาอาจถูกย้ายหรือไม่มีอยู่จริง</p>
      <Link href="/" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
