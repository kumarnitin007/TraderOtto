"use client";

import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { vaultBarcodeFormat, type VaultBarcodeFormat } from "@/lib/vaultRepository";
import { wifiQrPayload } from "@/lib/wifiQr";

type BarcodeChoice = {
  format: VaultBarcodeFormat;
  label: string;
  accepts: (value: string) => boolean;
};

const CHOICES: BarcodeChoice[] = [
  { format: "CODE128", label: "Code 128", accepts: () => true },
  { format: "CODABAR", label: "Codabar", accepts: (value) => /^[0-9\-$:/.+]+$/.test(value) },
  {
    format: "CODE39",
    label: "Code 39",
    accepts: (value) => /^[0-9A-Z .\-$/+%]+$/.test(value),
  },
  { format: "QR", label: "QR code", accepts: () => true },
];

export function barcodeChoices(value: string) {
  return CHOICES.filter((choice) => choice.accepts(value));
}

export function BarcodePanel({
  value,
  format,
  onFormat,
}: {
  value: string;
  format?: VaultBarcodeFormat;
  onFormat?: (format: VaultBarcodeFormat) => void;
}) {
  const choices = barcodeChoices(value);
  const [selected, setSelected] = useState<VaultBarcodeFormat>(() => vaultBarcodeFormat(format));
  useEffect(() => {
    setSelected(vaultBarcodeFormat(format));
  }, [format]);
  const active = choices.some((choice) => choice.format === selected) ? selected : "CODE128";
  const choice = choices.find((item) => item.format === active) ?? choices[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-2">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {choices.map((item) => (
          <button
            key={item.format}
            type="button"
            aria-pressed={item.format === choice.format}
            onClick={() => {
              setSelected(item.format);
              onFormat?.(item.format);
            }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
              item.format === choice.format
                ? "bg-otto-text text-otto-bg"
                : "bg-otto-surface text-otto-text-dim"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {choice.format === "QR" ? (
        <QrCard title="QR code" value={value} />
      ) : (
        <BarcodeCard value={value} choice={choice} />
      )}
    </div>
  );
}

export function WifiQrPanel({ ssid, password }: { ssid: string; password: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-2">
      <p className="mb-3 rounded-xl bg-otto-amber-soft px-3 py-2 text-[12px] leading-relaxed text-otto-amber">
        This code contains the Wi-Fi password. Anyone who scans it can join the network. It assumes WPA.
      </p>
      <QrCard title={ssid} value={wifiQrPayload(ssid, password)} />
    </div>
  );
}

function QrCard({ title, value }: { title: string; value: string }) {
  const [markup, setMarkup] = useState("");

  useEffect(() => {
    let cancel = false;
    void QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then((svg) => {
      if (!cancel) setMarkup(svg);
    });
    return () => {
      cancel = true;
    };
  }, [value]);

  return (
    <section className="rounded-2xl bg-white p-4 text-black">
      <h3 className="mb-3 text-center text-[13px] font-bold">{title}</h3>
      {markup && (
        <div
          className="mx-auto w-[220px] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      )}
    </section>
  );
}

function BarcodeCard({
  value,
  choice,
}: {
  value: string;
  choice: Exclude<BarcodeChoice, { format: "QR" }>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    if (!svg.current) return;
    try {
      JsBarcode(svg.current, value, {
        format: choice.format,
        background: "#ffffff",
        lineColor: "#000000",
        width: 2,
        height: 120,
        margin: 16,
        displayValue: true,
        fontSize: 16,
      });
      setValid(true);
    } catch {
      setValid(false);
    }
  }, [choice.format, value]);

  if (!valid) return null;
  return (
    <section className="rounded-2xl bg-white p-3 text-black">
      <h3 className="text-center text-[13px] font-bold">{choice.label}</h3>
      <div className="mt-2 overflow-x-auto">
        <svg ref={svg} className="mx-auto h-auto w-full" aria-label={`${choice.label} barcode`} />
      </div>
    </section>
  );
}
