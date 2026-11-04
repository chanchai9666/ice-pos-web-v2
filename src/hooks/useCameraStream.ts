"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface UseCameraStreamOptions {
  facingMode?: "environment" | "user";
  preferredDeviceId?: string;
  autoStart?: boolean;
}

export interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: "environment" | "user";
  hasTorch: boolean;
  isTorchOn: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  toggleTorch: () => Promise<void>;
}

export function useCameraStream(
  options: UseCameraStreamOptions = {}
): UseCameraStreamReturn {
  const {
    facingMode: initialFacingMode = "environment",
    preferredDeviceId = null,
    autoStart = false,
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    initialFacingMode
  );
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    preferredDeviceId
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const mountedRef = useRef<boolean>(true);

  const facingModeRef = useRef<"environment" | "user">(facingMode);
  const selectedDeviceIdRef = useRef<string | null>(selectedDeviceId);
  const devicesRef = useRef<MediaDeviceInfo[]>(devices);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Clean stop for camera stream & active video tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          if (track.readyState === "live") {
            track.stop();
          }
        } catch {
          // ignore track stop error
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    activeTrackRef.current = null;
    setStream(null);
    setIsActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Internal start implementation with configurable deviceId and facingMode
  const startCameraInternal = useCallback(
    async (
      targetDeviceId?: string | null,
      targetFacingMode?: "environment" | "user"
    ) => {
      stopCamera();
      setError(null);
      setIsLoading(true);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError(
          "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องเว็บแคม (กรุณาตรวจสอบสิทธิ์ของกล้อง หรือเปิดด้วย Safari/Chrome เวอร์ชันล่าสุด)"
        );
        setIsLoading(false);
        return;
      }

      const deviceIdToUse =
        targetDeviceId !== undefined
          ? targetDeviceId
          : selectedDeviceIdRef.current;
      const modeToUse = targetFacingMode || facingModeRef.current;

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceIdToUse ? { exact: deviceIdToUse } : undefined,
          facingMode: deviceIdToUse ? undefined : { ideal: modeToUse },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      };

      try {
        const newStream =
          await navigator.mediaDevices.getUserMedia(constraints);

        if (!mountedRef.current) {
          newStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          return;
        }

        streamRef.current = newStream;
        setStream(newStream);
        setIsActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play().catch(() => {});
        }

        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          activeTrackRef.current = videoTrack;
          try {
            const capabilities = (videoTrack.getCapabilities?.() || {}) as {
              torch?: boolean;
              focusMode?: string[];
            };

            setHasTorch(Boolean(capabilities.torch));

            if (
              capabilities.focusMode &&
              capabilities.focusMode.includes("continuous") &&
              videoTrack.applyConstraints
            ) {
              videoTrack
                .applyConstraints({
                  advanced: [
                    { focusMode: "continuous" } as MediaTrackConstraintSet,
                  ],
                })
                .catch(() => {});
            }
          } catch {
            setHasTorch(false);
          }
        } else {
          setHasTorch(false);
        }

        setIsTorchOn(false);

        // Enumerate video devices if available
        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(
              (d) => d.kind === "videoinput"
            );
            if (mountedRef.current) {
              setDevices(videoDevices);
              devicesRef.current = videoDevices;
            }
          } catch {
            // ignore device listing error
          }
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
        const name = err instanceof Error ? err.name : "";

        if (
          name === "NotAllowedError" ||
          msg.includes("Permission") ||
          msg.includes("denied")
        ) {
          setError(
            "กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ (Settings > Safari/Chrome > Camera)"
          );
        } else if (
          name === "NotFoundError" ||
          msg.includes("Requested device not found") ||
          msg.includes("DevicesNotFoundError")
        ) {
          setError("ไม่พบอุปกรณ์กล้องบนเครื่องนี้");
        } else {
          setError(`ไม่สามารถเริ่มต้นกล้องได้: ${msg}`);
        }
        setIsActive(false);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [stopCamera]
  );

  const startCamera = useCallback(async () => {
    await startCameraInternal();
  }, [startCameraInternal]);

  const switchCamera = useCallback(async () => {
    const currentDevices = devicesRef.current;
    if (currentDevices.length > 1) {
      const currentId = selectedDeviceIdRef.current;
      const foundIndex = currentId
        ? currentDevices.findIndex((d) => d.deviceId === currentId)
        : -1;
      const currentIndex = foundIndex >= 0 ? foundIndex : 0;
      const nextIndex = (currentIndex + 1) % currentDevices.length;
      const nextDevice = currentDevices[nextIndex];
      setSelectedDeviceId(nextDevice.deviceId);
      selectedDeviceIdRef.current = nextDevice.deviceId;
      await startCameraInternal(nextDevice.deviceId, undefined);
    } else {
      const nextFacingMode =
        facingModeRef.current === "environment" ? "user" : "environment";
      setFacingMode(nextFacingMode);
      facingModeRef.current = nextFacingMode;
      setSelectedDeviceId(null);
      selectedDeviceIdRef.current = null;
      await startCameraInternal(null, nextFacingMode);
    }
  }, [startCameraInternal]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      selectedDeviceIdRef.current = deviceId;
      await startCameraInternal(deviceId, undefined);
    },
    [startCameraInternal]
  );

  const toggleTorch = useCallback(async () => {
    const track = activeTrackRef.current;
    if (!track || !track.applyConstraints || !hasTorch) return;

    try {
      const nextTorch = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn("Toggle torch failed:", e);
    }
  }, [hasTorch, isTorchOn]);

  useEffect(() => {
    mountedRef.current = true;

    if (autoStart) {
      startCameraInternal();
    }

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [autoStart, startCameraInternal, stopCamera]);

  return {
    videoRef,
    stream,
    isActive,
    isLoading,
    error,
    facingMode,
    hasTorch,
    isTorchOn,
    devices,
    selectedDeviceId,
    startCamera,
    stopCamera,
    switchCamera,
    selectDevice,
    toggleTorch,
  };
}
