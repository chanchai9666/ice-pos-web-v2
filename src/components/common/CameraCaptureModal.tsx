"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, RefreshCw, Check, AlertCircle } from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setErrorMessage(null);
    setIsLoading(true);

    let acquiredStream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง");
      }

      acquiredStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = acquiredStream;
      if (videoRef.current) {
        videoRef.current.srcObject = acquiredStream;
        await videoRef.current.play().catch((playErr: unknown) => {
          if (playErr instanceof Error && playErr.name === "AbortError") {
            return;
          }
          throw playErr;
        });
      }
    } catch (err: unknown) {
      if (acquiredStream) {
        acquiredStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }
      stopStream();

      const msg =
        err instanceof Error ? err.message : "ไม่สามารถเข้าถึงกล้องได้";
      if (msg.includes("Permission") || msg.includes("denied")) {
        setErrorMessage("กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์");
      } else {
        setErrorMessage(`ไม่สามารถเปิดกล้องได้: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (isOpen && !capturedDataUrl) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, capturedDataUrl, startCamera, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedDataUrl(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleClose = useCallback(() => {
    stopStream();
    setCapturedDataUrl(null);
    setErrorMessage(null);
    onClose();
  }, [stopStream, onClose]);

  const handleConfirm = useCallback(() => {
    if (!capturedDataUrl) return;

    // Convert dataURL to File
    const arr = capturedDataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    const filename = `product-photo-${Date.now()}.jpg`;
    const file = new File([u8arr], filename, { type: mime });

    onCapture(file);
    handleClose();
  }, [capturedDataUrl, onCapture, handleClose]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card bg-base-100 w-full max-w-lg border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-black text-base-content">
              {capturedDataUrl ? "ตรวจสอบรูปถ่าย" : "ถ่ายภาพสินค้า"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View / Preview */}
        <div className="p-4 flex flex-col items-center">
          {errorMessage ? (
            <div className="alert alert-error text-sm font-bold rounded-2xl p-4 my-8 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <div className="relative w-full aspect-4/3 bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
              {capturedDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedDataUrl}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === "user" ? "scale-x-[-1]" : ""
                    }`}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white gap-2 font-bold">
                      <span className="loading loading-spinner loading-md"></span>
                      กำลังเปิดกล้อง...
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="w-full mt-4 flex items-center justify-between gap-3">
            {capturedDataUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn btn-outline flex-1 h-12 rounded-xl font-bold gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  ถ่ายใหม่
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn btn-primary flex-1 h-12 rounded-xl font-black gap-2 shadow-sm"
                >
                  <Check className="w-5 h-5" />
                  ใช้รูปนี้
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  disabled={isLoading || Boolean(errorMessage)}
                  className="btn btn-outline btn-circle h-12 w-12"
                  title="สลับกล้องหน้า/หลัง"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={isLoading || Boolean(errorMessage)}
                  className="btn btn-primary flex-1 h-12 rounded-xl font-black text-base gap-2 shadow-md"
                >
                  <Camera className="w-5 h-5" />
                  กดถ่ายภาพ
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
