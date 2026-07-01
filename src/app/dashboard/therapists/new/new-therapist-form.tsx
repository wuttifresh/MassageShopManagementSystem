"use client";

import { createTherapist } from "../actions";
import { TherapistForm } from "../therapist-form";

export function NewTherapistForm({
  branchId,
  services,
}: {
  branchId: string;
  services: { id: string; name: string }[];
}) {
  return (
    <TherapistForm
      services={services}
      isEditing={false}
      onSubmit={(values) =>
        createTherapist({
          branchId,
          nickname: values.nickname,
          bio: values.bio,
          commissionType: values.commissionType,
          commissionRate: values.commissionRate,
          specialtyServiceIds: values.specialtyServiceIds,
        })
      }
    />
  );
}
