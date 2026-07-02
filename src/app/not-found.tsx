import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-lg font-semibold text-gray-900">ไม่พบหน้านี้</h1>
      <p className="text-sm text-text-secondary">หน้าที่คุณกำลังหาอาจถูกย้ายหรือไม่มีอยู่จริง</p>
      <LinkButton href="/">กลับหน้าแรก</LinkButton>
    </main>
  );
}
