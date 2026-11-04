"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  prepareZXingModule,
  readBarcodesFromImageData,
  type ReaderOptions,
} from "zxing-wasm/reader";
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

// Configure ZXing WASM binary location (self-hosted in public/wasm/)
if (typeof window !== "undefined") {
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => {
        if (path.endsWith(".wasm")) {
          return `/wasm/${path}`;
        }
        return prefix + path;
      },
    },
  });
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => boolean | Promise<boolean | void> | void;
  continuous?: boolean;
  allowContinuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  continuous = false,
  allowContinuous = true,
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
  const [isContinuous, setIsContinuous] = useState(
    allowContinuous ? continuous : false
  );

  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [scannedCount, setScannedCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isScanningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  const isContinuousRef = useRef(isContinuous);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isContinuousRef.current = isContinuous;
  }, [isContinuous]);

  useEffect(() => {
    if (isOpen) {
      setIsContinuous(allowContinuous ? continuous : false);
      setScannedCount(0);
      setScanStatus("idle");
      setStatusMessage("");
    }
  }, [isOpen, allowContinuous, continuous]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Clean stop for camera stream & animation loop
  const stopScanner = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          if (track.readyState === "live") {
            track.stop();
          }
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    activeTrackRef.current = null;
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Enumerate cameras when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      return;
    }

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoDevices = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, idx) => ({
            id: d.deviceId,
            label: d.label || `กล้อง ${idx + 1}`,
          }));
        if (videoDevices.length > 0) {
          setCameras(videoDevices);
        }
      })
      .catch((err) => {
        console.warn("Could not list cameras:", err);
      });
  }, [isOpen]);

  // Main camera start and scan lifecycle
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

    const startCamera = async () => {
      try {
        const isIOS =
          typeof navigator !== "undefined" &&
          (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" &&
              navigator.maxTouchPoints > 1));

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

        if (isIOS) {
          setDeviceNotice(
            "แนะนำถือบาร์โค้ดให้นิ่งในระยะ 15–20 ซม. หลีกเลี่ยงแสงสะท้อนบนขวดแก้ว"
          );
        } else {
          setDeviceNotice(null);
        }

        const selectedCameraId =
          cameras.length > 0 && cameras[cameraIndex % cameras.length]
            ? cameras[cameraIndex % cameras.length].id
            : undefined;

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: selectedCameraId
              ? { exact: selectedCameraId }
              : undefined,
            facingMode: selectedCameraId ? undefined : { ideal: "environment" },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          activeTrackRef.current = track;
          try {
            const capabilities = (track.getCapabilities?.() || {}) as {
              torch?: boolean;
              focusMode?: string[];
            };

            if (capabilities.torch) {
              setHasTorch(true);
            }

            if (
              capabilities.focusMode &&
              capabilities.focusMode.includes("continuous") &&
              track.applyConstraints
            ) {
              track
                .applyConstraints({
                  advanced: [
                    { focusMode: "continuous" } as MediaTrackConstraintSet,
                  ],
                })
                .catch(() => {});
            }
          } catch {
            // ignore capability detection error
          }
        }

        if (isMounted) {
          setIsInitializing(false);
        }

        // Reader options optimized for retail products (EAN-13, UPC, Code-128, QR)
        const scanOptions: ReaderOptions = {
          formats: [
            "EAN13",
            "EAN8",
            "Code128",
            "Code39",
            "UPCA",
            "UPCE",
            "QRCode",
            "ITF",
            "Codabar",
          ],
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
        };

        let lastFrameTimestamp = 0;
        const intervalMs = 80; // ~12 FPS: snappy response, lightweight CPU usage

        const scanLoop = async (timestamp: number) => {
          if (!isMounted || !isScanningRef.current) return;

          if (
            timestamp - lastFrameTimestamp >= intervalMs &&
            !isProcessingRef.current &&
            videoRef.current &&
            videoRef.current.readyState >= 2 &&
            videoRef.current.videoWidth > 0
          ) {
            lastFrameTimestamp = timestamp;
            const video = videoRef.current;
            const vWidth = video.videoWidth;
            const vHeight = video.videoHeight;

            if (!canvasRef.current) {
              canvasRef.current = document.createElement("canvas");
            }
            const canvas = canvasRef.current;

            // 1. First Priority: Reticle Center Crop (center 65% width, 50% height)
            // Eliminates sky/window backlighting & external glare, providing ideal contrast
            // for tricky 1D barcodes on curved bottles.
            const cropW = Math.round(vWidth * 0.65);
            const cropH = Math.round(vHeight * 0.5);
            const cropX = Math.round((vWidth - cropW) / 2);
            const cropY = Math.round((vHeight - cropH) / 2);

            canvas.width = cropW;
            canvas.height = cropH;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            let detectedText: string | null = null;

            if (ctx) {
              ctx.drawImage(
                video,
                cropX,
                cropY,
                cropW,
                cropH,
                0,
                0,
                cropW,
                cropH
              );
              const reticleData = ctx.getImageData(0, 0, cropW, cropH);
              try {
                const barcodes = await readBarcodesFromImageData(
                  reticleData,
                  scanOptions
                );
                if (barcodes.length > 0 && barcodes[0].text) {
                  detectedText = barcodes[0].text.trim();
                }
              } catch {
                // Ignore frame decode error
              }
            }

            // 2. Fallback: Full frame scan if reticle didn't match
            if (!detectedText && ctx) {
              canvas.width = vWidth;
              canvas.height = vHeight;
              ctx.drawImage(video, 0, 0, vWidth, vHeight);
              const fullData = ctx.getImageData(0, 0, vWidth, vHeight);
              try {
                const barcodes = await readBarcodesFromImageData(
                  fullData,
                  scanOptions
                );
                if (barcodes.length > 0 && barcodes[0].text) {
                  detectedText = barcodes[0].text.trim();
                }
              } catch {
                // Ignore frame decode error
              }
            }

            if (detectedText) {
              const code = detectedText;
              const now = Date.now();
              const isCont = isContinuousRef.current;

              // Prevent duplicate triggers within 1.5s in continuous mode
              if (
                !isCont ||
                lastScanRef.current.code !== code ||
                now - lastScanRef.current.time >= 1500
              ) {
                if (!isProcessingRef.current) {
                  isProcessingRef.current = true;
                  lastScanRef.current = { code, time: now };

                  try {
                    const result = await Promise.resolve(
                      onDetectedRef.current(code)
                    );
                    if (result === false) {
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
                      playBeepSound();
                      triggerHapticFeedback(80);
                      setScanStatus("success");
                      setStatusMessage(`สแกนสำเร็จ: ${code}`);
                      setScannedCount((c) => c + 1);

                      if (isCont) {
                        setTimeout(() => {
                          setScanStatus("idle");
                          setStatusMessage("");
                          isProcessingRef.current = false;
                        }, 1200);
                      } else {
                        setTimeout(() => {
                          stopScanner();
                          onCloseRef.current();
                        }, 250);
                      }
                    }
                  } catch {
                    isProcessingRef.current = false;
                  }
                }
              }
            }
          }

          if (isMounted && isScanningRef.current) {
            animFrameRef.current = requestAnimationFrame(scanLoop);
          }
        };

        isScanningRef.current = true;
        animFrameRef.current = requestAnimationFrame(scanLoop);
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
    };

    startCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen, stopScanner, cameraIndex, cameras]);

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    stopScanner();
    setCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  const toggleTorch = async () => {
    const track = activeTrackRef.current;
    if (!track || !track.applyConstraints) return;
    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
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
                stopScanner();
                onClose();
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
              ? "สแกนสินค้าต่อเนื่อง — วางแถบบาร์โค้ดในกรอบ"
              : "นำเส้นบาร์โค้ดสินค้ามาวางในกรอบเล็ง (สแกนแล้วปิดอัตโนมัติ)"}
          </p>

          {errorMessage ? (
            <div className="alert alert-error text-sm font-bold rounded-2xl p-4 my-6 flex items-center gap-2 w-full">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <div className="relative w-full aspect-4/3 sm:aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Reticle Overlay */}
              {!isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 z-10">
                  <div
                    className={`relative w-[85%] max-w-[340px] h-[50%] max-h-[190px] rounded-2xl border-2 transition-all duration-200 flex items-center justify-center ${
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
                      <span>
                        วางบาร์โค้ดในกรอบ (ระยะ 15–20 ซม.) หลบแสงสะท้อน
                      </span>
                    )}
                  </div>
                </div>
              )}

              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white gap-2 font-bold z-20">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                  <span>กำลังเปิดกล้องความเร็วสูง...</span>
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
          {allowContinuous && (
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
          )}

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
                    stopScanner();
                    onClose();
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
                  stopScanner();
                  onClose();
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
