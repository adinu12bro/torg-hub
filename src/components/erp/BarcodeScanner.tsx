import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, CameraOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * 1D barcode scanning only (QR is intentionally out of scope for V1;
 * the database already supports a `qr` code type for a future release).
 */
const HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ],
  ],
]);

export function CameraScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    const reader = new BrowserMultiFormatReader(HINTS);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && !stopped) {
          stopped = true;
          onDetected(result.getText());
          controls?.stop();
          onOpenChange(false);
        }
      })
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>Hold the barcode steady inside the frame.</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CameraOff className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Use the manual field or a USB/Bluetooth scanner instead.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full rounded-md bg-black object-cover"
            muted
            playsInline
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScanButton({ onDetected }: { onDetected: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Camera className="mr-2 h-4 w-4" aria-hidden />
        Camera scan
      </Button>
      <CameraScannerDialog open={open} onOpenChange={setOpen} onDetected={onDetected} />
    </>
  );
}

/**
 * USB / Bluetooth scanners behave like keyboards: they type fast and end with Enter.
 * This captures those bursts anywhere on the page (unless typing in an input).
 */
export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let last = 0;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const now = Date.now();
      if (now - last > 120) buffer = "";
      last = now;

      if (e.key === "Enter") {
        if (buffer.length >= 4 && !typing) {
          onScan(buffer);
          e.preventDefault();
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan, enabled]);
}
