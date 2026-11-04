"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Camera,
  X,
  Zap,
  ZapOff,
  SwitchCamera,
  AlertCircle,
  Plus,
  Sparkles,
  Package,
  CheckCircle2,
} from "lucide-react";
import type { Product } from "../../types/api.ts";
import { useCameraStream } from "../../hooks/useCameraStream.ts";
import { visionWorkerClient } from "../../services/visionWorkerClient.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import type { MatchResult } from "../../services/visualMatch.ts";
import { playBeepSound, triggerHapticFeedback } from "../../utils/audio.ts";
import { formatBaht } from "../../utils/currency.ts";
import {
  shouldTriggerSound,
  getViewfinderBorderClass,
  formatConfidencePercent,
  getCandidatesWithProducts,
} from "./cameraScannerLogic.ts";

export {
  shouldTriggerSound,
  getViewfinderBorderClass,
  formatConfidencePercent,
  getCandidatesWithProducts,
};

export interface CameraProductScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  products?: Product[];
}

export const CameraProductScannerModal: React.FC<
  CameraProductScannerModalProps
> = ({ isOpen, onClose, onSelectProduct, products }) => {
  const {
    videoRef,
    isActive,
    isLoading: isCameraLoading,
    error: cameraError,
    hasTorch,
    isTorchOn,
    devices,
    switchCamera,
    toggleTorch,
    stopCamera,
    startCamera,
  } = useCameraStream({
    autoStart: isOpen,
    facingMode: "environment",
  });

  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastAlertedProductIdRef = useRef<string | null>(null);
  const lastAlertedTimeRef = useRef<number>(0);

  // เตรียมรายการข้อมูลสินค้าสำหรับอ้างอิง
  const allProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    return offlineStorage.getCatalog().products;
  }, [products]);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of allProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [allProducts]);

  // เริ่มต้นโมเดล AI Vision และโหลดเวกเตอร์แคตตาล็อกสินค้า
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const unsubscribeProgress = visionWorkerClient.onProgress((p) => {
      if (isMounted) {
        setLoadProgress(Math.round(p));
      }
    });

    const initWorker = async () => {
      try {
        if (!visionWorkerClient.isReady()) {
          setIsModelLoading(true);
          await visionWorkerClient.init();
        }
        if (isMounted) {
          const embeddings = offlineStorage.getAllProductEmbeddings();
          visionWorkerClient.updateCatalog(embeddings);
        }
      } catch (err) {
        console.warn("Vision worker initialization error:", err);
      } finally {
        if (isMounted) {
          setIsModelLoading(false);
        }
      }
    };

    initWorker();

    return () => {
      isMounted = false;
      unsubscribeProgress();
    };
  }, [isOpen]);

  // รอบการสแกนภาพและคำนวณจับคู่สินค้าทุกๆ 600ms เมื่อกล้องพร้อมทำงาน
  useEffect(() => {
    if (!isOpen || !isActive) {
      setMatchResult(null);
      isProcessingRef.current = false;
      lastAlertedProductIdRef.current = null;
      lastAlertedTimeRef.current = 0;
      return;
    }

    let isMounted = true;

    const intervalId = setInterval(async () => {
      if (
        isProcessingRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        return;
      }

      try {
        isProcessingRef.current = true;
        const video = videoRef.current;

        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvasRef.current = canvas;
        }
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          if (vw > 0 && vh > 0) {
            // ตัดภาพกึ่งกลางเป็นสี่เหลี่ยมจัตุรัสให้ตรงกับกรอบเล็งเป้า
            const size = Math.min(vw, vh);
            const sx = (vw - size) / 2;
            const sy = (vh - size) / 2;
            ctx.drawImage(video, sx, sy, size, size, 0, 0, 320, 320);
          } else {
            ctx.drawImage(video, 0, 0, 320, 320);
          }

          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const res = await visionWorkerClient.matchFrame(dataUrl);

          if (!isMounted) return;

          setMatchResult(res);

          const bestPid = res.bestMatch?.productId;
          const now = Date.now();

          if (
            shouldTriggerSound(
              res.tier,
              bestPid,
              lastAlertedProductIdRef.current,
              lastAlertedTimeRef.current,
              now
            )
          ) {
            lastAlertedProductIdRef.current = bestPid!;
            lastAlertedTimeRef.current = now;
            playBeepSound();
            triggerHapticFeedback(60);
          } else if (res.tier === "NO_MATCH") {
            lastAlertedProductIdRef.current = null;
          }
        }
      } catch (err) {
        console.warn("Visual frame matching error:", err);
      } finally {
        isProcessingRef.current = false;
      }
    }, 600);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isOpen, isActive, videoRef]);

  // ปิดหน้าต่างโมดอลพร้อมหยุดการทำงานของสตรีมกล้อง
  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // จัดการเมื่อผู้ใช้กดเลือกสินค้าเพื่อเพิ่มลงตะกร้า
  const handleSelectProduct = useCallback(
    (product: Product) => {
      setRecentlyAddedId(product.id);
      onSelectProduct(product);
      setTimeout(() => {
        setRecentlyAddedId((curr) => (curr === product.id ? null : curr));
      }, 1500);
    },
    [onSelectProduct]
  );

  if (!isOpen) {
    return null;
  }

  // หาสินค้าอันดับ 1 สำหรับกรณี HIGH_CONFIDENCE
  const bestMatchCandidate = matchResult?.bestMatch;
  const bestMatchProduct = bestMatchCandidate
    ? productsMap.get(bestMatchCandidate.productId)
    : undefined;

  // หาสินค้าตัวเลือก 2-4 รายการสำหรับกรณี AMBIGUOUS
  const ambiguousCandidates =
    matchResult?.tier === "AMBIGUOUS"
      ? getCandidatesWithProducts(
          matchResult.candidates.slice(0, 4),
          productsMap
        )
      : [];

  const tier = matchResult?.tier ?? "NO_MATCH";
  const viewfinderBorderClass = getViewfinderBorderClass(tier);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="card bg-base-100 w-full max-w-lg border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-base-content leading-tight flex items-center gap-1.5">
                <span>สแกนสินค้าด้วยภาพถ่าย</span>
                <span className="badge badge-primary badge-xs sm:badge-sm font-bold">
                  AI Vision
                </span>
              </h3>
              <p className="text-xs text-base-content/60 font-medium">
                จ่อกล้องที่สินค้าเพื่อค้นหาอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {devices.length > 1 && (
              <button
                type="button"
                onClick={() => switchCamera()}
                className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-base-content"
                title="สลับเลนส์กล้อง"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={() => toggleTorch()}
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
              onClick={handleClose}
              className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-base-content"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body & Viewport */}
        <div className="p-3 sm:p-4 flex flex-col items-center gap-3 overflow-y-auto">
          {cameraError ? (
            <div className="alert alert-error text-sm font-bold rounded-2xl p-4 my-4 flex flex-col items-start gap-2 w-full">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{cameraError}</span>
              </div>
              <button
                type="button"
                onClick={() => startCamera()}
                className="btn btn-sm btn-outline border-error-content/40 text-error-content font-bold self-end mt-1 rounded-xl"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <div className="relative w-full aspect-square sm:aspect-4/3 max-h-[320px] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center shrink-0">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Reticle Overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
                <div
                  className={`relative w-[70%] max-w-[240px] aspect-square rounded-2xl border-2 transition-all duration-200 flex items-center justify-center ${viewfinderBorderClass}`}
                >
                  {/* กรอบมุม 4 ทิศ */}
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-white/70 rounded-tl-sm"></div>
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white/70 rounded-tr-sm"></div>
                  <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-white/70 rounded-bl-sm"></div>
                  <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-white/70 rounded-br-sm"></div>

                  {isCameraLoading && (
                    <div className="flex flex-col items-center gap-2 bg-black/60 backdrop-blur-sm p-3 rounded-xl text-white">
                      <span className="loading loading-spinner loading-md text-primary"></span>
                      <span className="text-xs font-bold">
                        กำลังเปิดกล้อง...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading progress bar for Vision AI Model */}
              {isModelLoading && (
                <div className="absolute inset-x-3 bottom-3 z-20 bg-base-100/90 backdrop-blur-md border border-base-300 rounded-xl p-2.5 shadow-lg flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-base-content">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                      กำลังเตรียมโมเดล AI Vision บนอุปกรณ์...
                    </span>
                    <span className="text-primary font-black">
                      {loadProgress}%
                    </span>
                  </div>
                  <progress
                    className="progress progress-primary w-full h-2 rounded-full"
                    value={loadProgress}
                    max="100"
                  />
                </div>
              )}
            </div>
          )}

          {/* Result & Recommendation Section */}
          <div className="w-full flex flex-col gap-2.5 min-h-[110px]">
            {tier === "HIGH_CONFIDENCE" &&
            bestMatchProduct &&
            bestMatchCandidate ? (
              <div className="p-3 sm:p-3.5 bg-success/10 border-2 border-success/40 rounded-2xl flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-success/20 text-success flex items-center justify-center shrink-0 font-bold">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-success-content/70 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span>พบสินค้าตรงกัน</span>
                        <span className="badge badge-success badge-xs font-bold text-white ml-1">
                          {formatConfidencePercent(bestMatchCandidate.score)}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-base-content truncate">
                        {bestMatchProduct.name}
                      </h4>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-black text-success leading-tight">
                      {formatBaht(
                        bestMatchProduct.unit_price ??
                          bestMatchProduct.price ??
                          0
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectProduct(bestMatchProduct)}
                  className={`btn h-11 sm:h-12 w-full rounded-xl font-black text-sm sm:text-base shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    recentlyAddedId === bestMatchProduct.id
                      ? "btn-success text-white"
                      : "btn-primary"
                  }`}
                >
                  {recentlyAddedId === bestMatchProduct.id ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>เพิ่มแล้ว เรียบร้อย!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>เพิ่มลงตะกร้า</span>
                    </>
                  )}
                </button>
              </div>
            ) : tier === "AMBIGUOUS" && ambiguousCandidates.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-warning-content px-1">
                  <span>
                    พบสินค้าใกล้เคียงหลายรายการ กรุณาเลือกรายการที่ถูกต้อง:
                  </span>
                  <span className="badge badge-warning badge-xs font-bold">
                    เลือก 1 รายการ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ambiguousCandidates.map(({ candidate, product }) => (
                    <button
                      key={candidate.productId}
                      type="button"
                      onClick={() => handleSelectProduct(product)}
                      className="p-2.5 bg-base-100 hover:bg-base-200 border-2 border-base-300 hover:border-warning rounded-2xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-base-content truncate">
                          {product.name}
                        </div>
                        <div className="text-xs font-black text-success">
                          {formatBaht(product.unit_price ?? product.price ?? 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="badge badge-ghost badge-xs font-semibold">
                          {formatConfidencePercent(candidate.score)}
                        </span>
                        <div className="btn btn-warning btn-xs rounded-lg px-2 font-bold">
                          เลือก
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-base-200/60 border border-base-300 rounded-2xl flex items-center gap-3 text-base-content/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm leading-snug">
                  <span className="font-bold text-base-content block">
                    จัดสินค้าให้อยู่ในกรอบเพื่อสแกน
                  </span>
                  <span>
                    ระบบ AI จะคำนวณเวกเตอร์จับคู่กับรูปสินค้าในร้านโดยอัตโนมัติ
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-base-200 bg-base-200/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-ghost btn-sm h-9 px-4 rounded-xl font-bold text-base-content/70 hover:text-base-content cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
