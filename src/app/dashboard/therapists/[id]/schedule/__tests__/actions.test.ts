import { describe, expect, it, vi, beforeEach } from "vitest";

const { therapistFindUnique, timeBlockCreate, timeBlockFindUnique, timeBlockDelete, auditLogCreate, transactionMock, requireStaffSession } =
  vi.hoisted(() => ({
    therapistFindUnique: vi.fn(),
    timeBlockCreate: vi.fn(),
    timeBlockFindUnique: vi.fn(),
    timeBlockDelete: vi.fn(),
    auditLogCreate: vi.fn(),
    transactionMock: vi.fn(),
    requireStaffSession: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    therapist: { findUnique: therapistFindUnique },
    therapistTimeBlock: { findUnique: timeBlockFindUnique, create: timeBlockCreate, delete: timeBlockDelete },
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/staff-auth", () => ({ requireStaffSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createTimeBlock, deleteTimeBlock } from "../actions";

const THERAPIST = { id: "therapist-1", branchId: "branch-1", deletedAt: null };
const SESSION = { user: { id: "staff-1", role: "STAFF", branchId: "branch-1" } };

beforeEach(() => {
  therapistFindUnique.mockReset().mockResolvedValue(THERAPIST);
  timeBlockCreate.mockReset().mockResolvedValue({ id: "block-1" });
  timeBlockFindUnique.mockReset();
  timeBlockDelete.mockReset();
  auditLogCreate.mockReset();
  requireStaffSession.mockReset().mockResolvedValue(SESSION);
  transactionMock.mockReset().mockImplementation(async (fn) =>
    fn({
      therapistTimeBlock: { create: timeBlockCreate, delete: timeBlockDelete },
      auditLog: { create: auditLogCreate },
    })
  );
});

describe("createTimeBlock", () => {
  it("creates a time block and an audit log entry when the range is valid", async () => {
    const result = await createTimeBlock("therapist-1", "2026-08-01", "12:00", "13:00", "พักเที่ยง");

    expect(result).toEqual({ success: true });
    expect(timeBlockCreate).toHaveBeenCalledWith({
      data: {
        therapistId: "therapist-1",
        branchId: "branch-1",
        date: new Date("2026-08-01"),
        startTime: "12:00",
        endTime: "13:00",
        reason: "พักเที่ยง",
      },
    });
    expect(auditLogCreate).toHaveBeenCalled();
  });

  it("rejects a range where the end time isn't after the start time", async () => {
    const result = await createTimeBlock("therapist-1", "2026-08-01", "13:00", "12:00", "");

    expect(result).toEqual({ success: false, error: "ช่วงเวลาไม่ถูกต้อง" });
    expect(timeBlockCreate).not.toHaveBeenCalled();
  });

  it("refuses to act when the caller has no staff session for this branch", async () => {
    requireStaffSession.mockResolvedValue(null);

    const result = await createTimeBlock("therapist-1", "2026-08-01", "12:00", "13:00", "");

    expect(result).toEqual({ success: false, error: "ไม่มีสิทธิ์ดำเนินการ" });
    expect(timeBlockCreate).not.toHaveBeenCalled();
  });

  it("returns not-found when the therapist doesn't exist", async () => {
    therapistFindUnique.mockResolvedValue(null);

    const result = await createTimeBlock("therapist-1", "2026-08-01", "12:00", "13:00", "");

    expect(result).toEqual({ success: false, error: "ไม่พบหมอนวด" });
  });
});

describe("deleteTimeBlock", () => {
  it("deletes a time block that belongs to the therapist", async () => {
    timeBlockFindUnique.mockResolvedValue({ id: "block-1", therapistId: "therapist-1", date: new Date("2026-08-01"), startTime: "12:00", endTime: "13:00", reason: null });

    const result = await deleteTimeBlock("therapist-1", "block-1");

    expect(result).toEqual({ success: true });
    expect(timeBlockDelete).toHaveBeenCalledWith({ where: { id: "block-1" } });
  });

  it("refuses to delete a time block belonging to a different therapist", async () => {
    timeBlockFindUnique.mockResolvedValue({ id: "block-1", therapistId: "therapist-2", date: new Date("2026-08-01"), startTime: "12:00", endTime: "13:00", reason: null });

    const result = await deleteTimeBlock("therapist-1", "block-1");

    expect(result).toEqual({ success: false, error: "ไม่พบช่วงเวลาที่บล็อก" });
    expect(timeBlockDelete).not.toHaveBeenCalled();
  });
});
