"use client";

import { createBranch } from "../actions";
import { BranchForm } from "../branch-form";

export function NewBranchForm() {
  return (
    <BranchForm
      isEditing={false}
      onSubmit={(values) =>
        createBranch({
          name: values.name,
          slug: values.slug,
          address: values.address,
          phone: values.phone,
          openTime: values.openTime,
          closeTime: values.closeTime,
        })
      }
    />
  );
}
