"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Barcode,
  X,
  AlertCircle,
  Zap,
  ZapOff,
  SwitchCamera,
  CheckCircle2,
} from "lucide-react";
import {
  playBeepSound,
  playErrorSound,
  triggerHapticFeedback,
} from "../../utils/audio.ts";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => boolean | Promise<boolean | void> | void;
  continuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  continuous = false,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>(
    []
  );
  const [cameraIndex, setCameraIndex] = useState(0);
  const [isContinuous, setIsContinuous] = useState(continuous);

  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [scannedCount, setScannedCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });
  const isContinuousRef = useRef(isContinuous);

  useEffect(() => {
    isContinuousRef.current = isContinuous;
  }, [isContinuous]);

  const containerId = "html5-barcode-scanner-box";

  // List available camera devices on mount
  useEffect(() => {
    if (!isOpen) return;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      })
      .catch((err) => {
        console.warn("Could not list cameras:", err);
      });
  }, [isOpen]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      } finally {
        // Force stop all media stream tracks on the video element in DOM
        try {
          const container = document.getElementById(containerId);
          const video = container?.querySelector(
            "video"
          ) as HTMLVideoElement | null;
          if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              track.stop();
            });
            video.srcObject = null;
          }
        } catch (e) {
          console.warn("Error forcing track stop:", e);
        }

        scannerRef.current = null;
        isStoppingRef.current = false;
        setIsTorchOn(false);
        setHasTorch(false);
      }
    } else if (!scannerRef.current) {
      // Force stop orphaned tracks even if scannerRef was already cleaned up
      try {
        const container = document.getElementById(containerId);
        const video = container?.querySelector(
          "video"
        ) as HTMLVideoElement | null;
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          video.srcObject = null;
        }
      } catch (e) {
        console.warn("Error forcing track stop on null scanner:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    isProcessingRef.current = false;
    lastScanRef.current = { code: "", time: 0 };
    setScanStatus("idle");
    setStatusMessage("");
    setScannedCount(0);
    setIsInitializing(true);
    setErrorMessage(null);
    setIsTorchOn(false);
    setHasTorch(false);

    let isMounted = true;

    // Small delay to ensure the DOM element exists
    const timer = setTimeout(async () => {
      if (!isMounted) return;

      try {
        // Detect browser environment / security limitations
        const isIOS =
          typeof navigator !== "undefined" &&
          (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" &&
              navigator.maxTouchPoints > 1));

        // Check if environment is secure context (HTTPS or localhost)
        const isSecure =
          typeof window !== "undefined" &&
          (window.isSecureContext ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1");

        if (!isSecure && isIOS) {
          setErrorMessage(
            "iOS Safari บล็อกการเข้าถึงกล้องบนการเชื่อมต่อที่ไม่ปลอดภัย (HTTP) กรุณาเปิดผ่าน HTTPS หรือใช้งานบนเครื่อง localhost"
          );
          setIsInitializing(false);
          return;
        }

        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setErrorMessage(
            "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องเว็บแคม (กรุณาตรวจสอบสิทธิ์ของกล้อง หรือเปิดด้วย Safari/Chrome เวอร์ชันล่าสุด)"
          );
          setIsInitializing(false);
          return;
        }

        // Informative notice for iOS Safari regarding Haptic and Software Fallback
        if (isIOS) {
          setDeviceNotice(
            "อุปกรณ์ iOS (Safari): ระบบสั่นไม่รองรับ และใช้การประมวลผลด้วยซอฟต์แวร์ แนะนำถือบาร์โค้ดให้นิ่งในระยะ 15–20 ซม. ในที่แสงสว่างเพียงพอ"
          );
        } else {
          setDeviceNotice(null);
        }

        // Supported product barcode formats for maximum speed & accuracy
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            // Leverage hardware/browser GPU BarcodeDetector API for instant detection
            useBarCodeDetectorIfSupported: true,
          },
        });
        scannerRef.current = scanner;

        // Optimized camera config: 720p ideal for crisp 1D barcode lines without overloading CPU
        const cameraTarget =
          cameras.length > 0 && cameras[cameraIndex % cameras.length]
            ? cameras[cameraIndex % cameras.length].id
            : {
                facingMode: "environment",
                width: { ideal: 1280, max: 1280 },
                height: { ideal: 720, max: 720 },
              };

        await scanner.start(
          cameraTarget,
          {
            fps: 25, // 25 frames per second for prompt detection
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Wide rectangular box optimized for 1D product barcodes
              const width = Math.min(viewfinderWidth * 0.88, 360);
              const height = Math.min(viewfinderHeight * 0.45, 170);
              return { width: Math.floor(width), height: Math.floor(height) };
            },
            aspectRatio: 1.333334,
            disableFlip: false,
          },
          (decodedText) => {
            const code = decodedText.trim();
            if (!code) return;

            const now = Date.now();
            const isCont = isContinuousRef.current;

            // Cooldown: prevent scanning identical barcode within 1.5 seconds in continuous mode
            if (
              isCont &&
              lastScanRef.current.code === code &&
              now - lastScanRef.current.time < 1500
            ) {
              return;
            }

            if (isProcessingRef.current) return;
            isProcessingRef.current = true;
            lastScanRef.current = { code, time: now };

            const processScan = async () => {
              try {
                const result = await Promise.resolve(onDetected(code));
                if (result === false) {
                  // Barcode not recognized in database
                  playErrorSound();
                  triggerHapticFeedback([100, 50, 100]);
                  setScanStatus("error");
                  setStatusMessage(`ไม่พบสินค้า: ${code}`);

                  setTimeout(() => {
                    setScanStatus("idle");
                    setStatusMessage("");
                    isProcessingRef.current = false;
                  }, 1500);
                } else {
                  // Successfully detected
                  playBeepSound();
                  triggerHapticFeedback(80);
                  setScanStatus("success");
                  setStatusMessage(`สแกนสำเร็จ: ${code}`);
                  setScannedCount((c) => c + 1);

                  if (!isCont) {
                    setTimeout(() => {
                      stopScanner().then(() => {
                        onClose();
                      });
                    }, 250);
                  } else {
                    setTimeout(() => {
                      setScanStatus("idle");
                      setStatusMessage("");
                      isProcessingRef.current = false;
                    }, 1200);
                  }
                }
              } catch {
                isProcessingRef.current = false;
              }
            };

            processScan();
          },
          () => {
            // Frame scanning error, normal while waiting for barcode
          }
        );

        if (isMounted) {
          setIsInitializing(false);
          // Check torch capability
          try {
            const track = (
              scanner as unknown as { getRunningTrack?: () => MediaStreamTrack }
            ).getRunningTrack?.();
            if (track) {
              const capabilities = (
                track as unknown as {
                  getCapabilities?: () => { torch?: boolean };
                }
              ).getCapabilities?.();
              if (capabilities && capabilities.torch) {
                setHasTorch(true);
              }
            }
          } catch {
            // ignore torch detection failure
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg =
          err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องสแกนได้";
        if (
          msg.includes("Permission") ||
          msg.includes("denied") ||
          msg.includes("NotAllowedError")
        ) {
          setErrorMessage(
            "กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ (Settings > Safari/Chrome > Camera)"
          );
        } else if (
          msg.includes("NotFoundError") ||
          msg.includes("Requested device not found")
        ) {
          setErrorMessage("ไม่พบอุปกรณ์กล้องบนเครื่องนี้");
        } else {
          setErrorMessage(`ไม่สามารถเริ่มต้นเครื่องสแกนได้: ${msg}`);
        }
        setIsInitializing(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [
    isOpen,
    onDetected,
    onClose,
    stopScanner,
    continuous,
    cameraIndex,
    cameras,
  ]);

  const switchCamera = async () => {
    if (cameras.length <= 1 || isStoppingRef.current) return;
    await stopScanner();
    setCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextState = !isTorchOn;
      await (
        scannerRef.current as unknown as {
          applyVideoConstraints: (constraints: {
            advanced: [{ torch: boolean }];
          }) => Promise<void>;
        }
      ).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn("Toggle torch failed:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="card bg-base-100 w-full max-w-md border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2">
            <Barcode className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-black text-base-content">
              สแกนบาร์โค้ดสินค้า
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-base-content"
                title="สลับเลนส์กล้อง"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`btn btn-ghost btn-circle btn-sm ${
                  isTorchOn ? "text-warning" : "text-base-content/70"
                }`}
                title={isTorchOn ? "ปิดไฟแฟลช" : "เปิดไฟแฟลช"}
              >
                {isTorchOn ? (
                  <Zap className="w-5 h-5 fill-current" />
                ) : (
                  <ZapOff className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopScanner().then(() => onClose());
              }}
              className="btn btn-ghost btn-circle btn-sm"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Body */}
        <div className="p-4 flex flex-col items-center">
          <p className="text-sm font-semibold text-base-content/70 mb-3 text-center">
            {isContinuous
              ? "สแกนสินค้าต่อเนื่อง — วางแถบบาร์โค้ดแนวนอนในกรอบ"
              : "นำเส้นบาร์โค้ดสินค้ามาวางในกรอบเล็ง (สแกนแล้วปิดอัตโนมัติ)"}
          </p>

          {errorMessage ? (
            <div className="alert alert-error text-sm font-bold rounded-2xl p-4 my-6 flex items-center gap-2 w-full">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <div className="relative w-full aspect-4/3 bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
              <div
                id={containerId}
                className="w-full h-full [&_video]:object-contain"
              />

              {/* Viewfinder Reticle Overlay */}
              {!isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 z-10">
                  <div
                    className={`relative w-[85%] max-w-[340px] h-[45%] max-h-[170px] rounded-2xl border-2 transition-all duration-200 flex items-center justify-center ${
                      scanStatus === "success"
                        ? "border-success bg-success/20 shadow-[0_0_30px_rgba(34,197,94,0.7)] scale-105"
                        : scanStatus === "error"
                          ? "border-error bg-error/20 shadow-[0_0_30px_rgba(239,68,68,0.7)]"
                          : "border-primary/80 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    }`}
                  >
                    {/* Corner Reticle Brackets */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-lg" />

                    {/* Laser Scanline */}
                    {scanStatus === "idle" && (
                      <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse" />
                    )}
                  </div>

                  {/* Realtime Status / Guidance Pill */}
                  <div className="mt-4 px-4 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-xs font-bold text-white tracking-wide shadow-lg flex items-center gap-1.5">
                    {scanStatus === "success" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="text-success font-black">
                          {statusMessage}
                        </span>
                      </>
                    ) : scanStatus === "error" ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-error" />
                        <span className="text-error font-black">
                          {statusMessage}
                        </span>
                      </>
                    ) : (
                      <span>วางแถบบาร์โค้ดแนวนอนในกรอบเล็ง</span>
                    )}
                  </div>
                </div>
              )}

              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white gap-2 font-bold z-20">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                  <span>กำลังปรับความชัดกล้อง...</span>
                </div>
              )}
            </div>
          )}

          {/* iOS Safari / Device Advisory Notice */}
          {deviceNotice && !errorMessage && (
            <div className="mt-3 alert alert-warning text-xs font-semibold py-2 px-3 rounded-xl flex items-start gap-2 w-full shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning-content" />
              <span className="text-warning-content leading-relaxed">
                {deviceNotice}
              </span>
            </div>
          )}

          {/* Continuous scan toggle */}
          <div className="w-full mt-3 flex items-center justify-between px-3.5 py-2 bg-base-200/60 rounded-xl border border-base-300/60">
            <span className="text-xs font-bold text-base-content/80">
              สแกนต่อเนื่องหลายชิ้น (เปิดกล้องค้างไว้)
            </span>
            <input
              type="checkbox"
              checked={isContinuous}
              onChange={(e) => setIsContinuous(e.target.checked)}
              className="toggle toggle-primary toggle-sm cursor-pointer"
            />
          </div>

          {/* Action / Continuous Done button */}
          <div className="w-full mt-4 flex items-center justify-between gap-3">
            {isContinuous ? (
              <>
                <div className="text-sm font-bold text-base-content/70 pl-2">
                  สแกนแล้ว{" "}
                  <span className="text-primary font-black text-lg">
                    {scannedCount}
                  </span>{" "}
                  ชิ้น
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopScanner().then(() => onClose());
                  }}
                  className="btn btn-primary h-12 px-6 rounded-xl font-black text-base shadow-lg"
                >
                  เสร็จสิ้น
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  stopScanner().then(() => onClose());
                }}
                className="btn btn-outline h-11 px-6 rounded-xl font-bold w-full"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
