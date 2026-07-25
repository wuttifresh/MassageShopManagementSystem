"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/locale-provider";

type Branch = { id: string; name: string; slug: string };
type ServiceOption = { id: string; durationMinutes: number };
type Service = { id: string; name: string; options: ServiceOption[] };

function LinkCard({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  const { dict } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a locally-generated data URL, not a remote image
          <img src={qrDataUrl} alt={title} className="h-[140px] w-[140px] shrink-0 rounded-lg border border-border" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="break-all rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? dict.bookingLinks.copied : dict.bookingLinks.copyLink}
            </Button>
            {qrDataUrl && (
              <a href={qrDataUrl} download="booking-qr.png">
                <Button type="button" size="sm" variant="outline">
                  {dict.bookingLinks.downloadQr}
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function BookingLinkGenerator({ branches, services }: { branches: Branch[]; services: Service[] }) {
  const { dict } = useTranslation();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [serviceOptionId, setServiceOptionId] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const allOptions = useMemo(
    () => services.flatMap((s) => s.options.map((o) => ({ ...o, serviceName: s.name }))),
    [services]
  );

  const shopUrl = origin && selectedBranch ? `${origin}/book-now?branch=${encodeURIComponent(selectedBranch.slug)}` : "";
  const serviceUrl =
    shopUrl && serviceOptionId ? `${shopUrl}&option=${encodeURIComponent(serviceOptionId)}` : "";

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field label={dict.bookingLinks.branchLabel} htmlFor="link-branch" className="flex-1">
            <Select id="link-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={dict.bookingLinks.serviceOptionLabel} htmlFor="link-service" className="flex-1">
            <Select id="link-service" value={serviceOptionId} onChange={(e) => setServiceOptionId(e.target.value)}>
              <option value="">{dict.bookingLinks.noServiceOption}</option>
              {allOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.serviceName} ({o.durationMinutes} {dict.dashboard.minutesSuffix})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {shopUrl && <LinkCard title={dict.bookingLinks.shopLinkTitle} description={dict.bookingLinks.shopLinkDescription} url={shopUrl} />}
      {serviceUrl && (
        <LinkCard title={dict.bookingLinks.serviceLinkTitle} description={dict.bookingLinks.serviceLinkDescription} url={serviceUrl} />
      )}
    </div>
  );
}
