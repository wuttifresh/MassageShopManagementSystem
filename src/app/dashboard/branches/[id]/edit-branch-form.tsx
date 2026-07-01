"use client";

import { updateBranch } from "../actions";
import { BranchForm, type BranchFormValues } from "../branch-form";

export function EditBranchForm({ branchId, initial }: { branchId: string; initial: BranchFormValues }) {
  return <BranchForm isEditing initial={initial} onSubmit={(input) => updateBranch(branchId, input)} />;
}
