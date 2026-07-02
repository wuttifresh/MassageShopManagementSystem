"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Textarea } from "./input";
import { Field } from "./field";
import { useTranslation } from "@/i18n/locale-provider";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  isLoading,
  requireReason,
  reasonLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
}) {
  const { dict } = useTranslation();
  const [reason, setReason] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      {requireReason && (
        <Field label={reasonLabel ?? dict.common.reason} required className="mb-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={dict.common.reasonPlaceholder}
            autoFocus
          />
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelLabel ?? dict.common.cancel}
        </Button>
        <Button
          type="button"
          variant={variant}
          isLoading={isLoading}
          disabled={requireReason && !reason.trim()}
          onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
        >
          {confirmLabel ?? dict.common.confirm}
        </Button>
      </div>
    </Modal>
  );
}
