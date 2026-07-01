"use client";

import { updateTherapist } from "../actions";
import { TherapistForm, type TherapistFormValues } from "../therapist-form";

export function EditTherapistForm({
  therapistId,
  services,
  initial,
}: {
  therapistId: string;
  services: { id: string; name: string }[];
  initial: TherapistFormValues;
}) {
  return (
    <TherapistForm
      services={services}
      isEditing
      initial={initial}
      onSubmit={(input) => updateTherapist(therapistId, input)}
    />
  );
}
