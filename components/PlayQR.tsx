"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * PlayQR
 *
 * The desktop desk shows a "scan to open this match on your mobile" QR in the
 * bottom-right corner (styled in the "Device frame" block of app/globals.css,
 * and hidden below lg where the app already IS on a phone).
 *
 * It only rides along with an open match, and encodes THAT match's deep link
 * (`path` = the current /match/[id] route) so a scan drops the player straight
 * into the same game on their phone, where DeviceFrame is a passthrough. The
 * base is the origin this page is served from, overridable with
 * NEXT_PUBLIC_APP_URL for a fixed production domain. Resolved after mount so
 * SSR and client agree (no hydration mismatch).
 */
export default function PlayQR({ path }: { path?: string }) {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }, []);

  // Trim a trailing slash off the base so we never emit a `//match/...` link.
  const url = origin ? `${origin.replace(/\/$/, "")}${path ?? ""}` : null;

  return (
    <a
      className="device-qr"
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Scan to open this match on your mobile"
    >
      <span className="device-qr-card">
        {url ? (
          <QRCodeSVG
            value={url}
            size={112}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#0c0c0e"
          />
        ) : (
          <span className="device-qr-ph" aria-hidden />
        )}
      </span>
      <span className="device-qr-cap">Scan to play this match on mobile</span>
    </a>
  );
}
