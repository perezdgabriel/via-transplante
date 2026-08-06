"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Shows the family-facing magic link with a copy button and an on-screen QR the family can scan at
// discharge. The origin is only known in the browser, so this stays a client component.
export function PatientLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = `${window.location.origin}/p/${token}`;
    QRCode.toDataURL(u, { margin: 1, width: 160 })
      .then((dataUrl) => {
        setUrl(u);
        setQr(dataUrl);
      })
      .catch(() => setUrl(u));
  }, [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the URL is visible to copy manually */
    }
  }

  return (
    <div className="flex items-center gap-4">
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="Código QR del enlace"
          width={96}
          height={96}
          className="rounded-lg bg-white p-1"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-zinc-500" title={url}>
          {url}
        </p>
        <button
          onClick={copy}
          className="mt-2 rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}
