"use client";

import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { wifiQrPayload } from "@/lib/wifiQr";

type BarcodeChoice = {
  format: string;
  label: string;
  note?: string;
  accepts: (value: string) => boolean;
};

const CHOICES: BarcodeChoice[] = [
  {
    format: "CODE128",
    label: "Code 128",
    note: "Closest to the library card. Try this one first.",
    accepts: () => true,
  },
  {
    format: "CODABAR",
    label: "Codabar",
    note: "The other format many library scanners accept.",
    accepts: (value) => /^[0-9\-$:/.+]+$/.test(value),
  },
  {
    format: "CODE39",
    label: "Code 39",
    accepts: (value) => /^[0-9A-Z .\-$/+%]+$/.test(value),
  },
  { format: "MSI", label: "MSI", accepts: (value) => /^\d+$/.test(value) },
  { format: "EAN13", label: "EAN-13", accepts: (value) => /^\d{12,13}$/.test(value) },
  { format: "UPC", label: "UPC-A", accepts: (value) => /^\d{11,12}$/.test(value) },
  { format: "ITF14", label: "ITF-14", accepts: (value) => /^\d{13,14}$/.test(value) },
];

export function BarcodePanel({ value }: { value: string }) {
  const choices = CHOICES.filter((choice) => choice.accepts(value));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-2">
      <p className="mb-3 text-[12px] leading-relaxed text-otto-text-dim">
        Generated on this device from the username. The QR code holds that same value, not the password.
      </p>
      <div className="space-y-3">
        <QrCard title="QR code" value={value} />
        {choices.map((choice) => (
          <BarcodeCard key={choice.format} value={value} choice={choice} />
        ))}
      </div>
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

function BarcodeCard({ value, choice }: { value: string; choice: BarcodeChoice }) {
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
      {choice.note && <p className="mt-1 text-center text-[11px] text-neutral-600">{choice.note}</p>}
      <div className="mt-2 overflow-x-auto">
        <svg ref={svg} className="mx-auto h-auto w-full" aria-label={`${choice.label} barcode`} />
      </div>
    </section>
  );
}
