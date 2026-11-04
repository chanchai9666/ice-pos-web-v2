import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { useCameraStream } from "./useCameraStream.ts";

// --- Lightweight Test Harness for React Hooks in Node.js ---
type AnyFunction = (...args: unknown[]) => unknown;

type HookDispatcher = {
  useState: <T>(
    init: T | (() => T)
  ) => [T, (next: T | ((prev: T) => T)) => void];
  useRef: <T>(init: T) => { current: T };
  useCallback: <T extends AnyFunction>(fn: T, deps?: unknown[]) => T;
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void;
};

function renderHook<T>(hookFn: () => T) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        H: HookDispatcher | null;
      };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  const states: unknown[] = [];
  const cleanups: (void | (() => void))[] = [];
  const refs: { current: unknown }[] = [];
  const callbacks: { fn: AnyFunction; deps?: unknown[] }[] = [];
  const effects: {
    effect: (() => void | (() => void)) | null;
    deps?: unknown[];
  }[] = [];

  let stateIndex = 0;
  let effectIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let isRunning = false;
  const result = { current: null as unknown as T };

  function render() {
    stateIndex = 0;
    refIndex = 0;
    callbackIndex = 0;
    effectIndex = 0;

    internals.H = {
      useState<S>(
        initial: S | (() => S)
      ): [S, (next: S | ((prev: S) => S)) => void] {
        const idx = stateIndex++;
        if (states.length <= idx) {
          states.push(
            typeof initial === "function" ? (initial as () => S)() : initial
          );
        }
        const setState = (next: S | ((prev: S) => S)) => {
          const prev = states[idx] as S;
          const newVal =
            typeof next === "function" ? (next as (p: S) => S)(prev) : next;
          if (!Object.is(states[idx], newVal)) {
            states[idx] = newVal;
            if (!isRunning) {
              render();
            }
          }
        };
        return [states[idx] as S, setState];
      },
      useRef<R>(initial: R): { current: R } {
        const idx = refIndex++;
        if (refs.length <= idx) {
          refs.push({ current: initial });
        }
        return refs[idx] as { current: R };
      },
      useCallback<F extends AnyFunction>(fn: F, deps?: unknown[]): F {
        const idx = callbackIndex++;
        if (callbacks.length <= idx) {
          callbacks.push({ fn, deps });
          return fn;
        }
        const prev = callbacks[idx];
        const hasChanged =
          !deps ||
          !prev.deps ||
          deps.some((d, i) => !Object.is(d, prev.deps![i]));
        if (hasChanged) {
          callbacks[idx] = { fn, deps };
          return fn;
        }
        return prev.fn as F;
      },
      useEffect(effect: () => void | (() => void), deps?: unknown[]) {
        const idx = effectIndex++;
        if (effects.length <= idx) {
          effects.push({ effect, deps });
        } else {
          const prev = effects[idx];
          const hasChanged =
            !deps ||
            !prev.deps ||
            deps.some((d, i) => !Object.is(d, prev.deps![i]));
          if (hasChanged) {
            effects[idx] = { effect, deps };
          } else {
            effects[idx] = { effect: null, deps };
          }
        }
      },
    };

    isRunning = true;
    result.current = hookFn();
    isRunning = false;

    // Run effects
    for (let i = 0; i < effects.length; i++) {
      if (effects[i].effect) {
        if (typeof cleanups[i] === "function") {
          try {
            (cleanups[i] as () => void)();
          } catch {}
        }
        cleanups[i] = effects[i].effect!();
      }
    }
  }

  function unmount() {
    for (let i = 0; i < cleanups.length; i++) {
      if (typeof cleanups[i] === "function") {
        try {
          (cleanups[i] as () => void)();
        } catch {}
      }
    }
    internals.H = null;
  }

  render();
  return { result, rerender: render, unmount };
}

// --- Mock MediaStream & Devices ---

class MockTrack {
  id = `track-${Math.random().toString(36).substring(2, 8)}`;
  kind = "video";
  label = "Mock Camera Track";
  readyState: "live" | "ended" = "live";
  capabilities: { torch?: boolean; focusMode?: string[] };
  appliedConstraints: Record<string, unknown> = {};

  constructor(capabilities: { torch?: boolean; focusMode?: string[] } = {}) {
    this.capabilities = capabilities;
  }

  stop() {
    this.readyState = "ended";
  }

  getCapabilities() {
    return this.capabilities;
  }

  async applyConstraints(constraints?: Record<string, unknown>) {
    this.appliedConstraints = constraints || {};
  }
}

class MockStream {
  id = `stream-${Math.random().toString(36).substring(2, 8)}`;
  tracks: MockTrack[];

  constructor(tracks: MockTrack[] = [new MockTrack({ torch: true })]) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
}

interface SetupMockMediaOptions {
  devices?: Array<{
    deviceId: string;
    kind: string;
    label: string;
    groupId: string;
  }>;
  capabilities?: { torch?: boolean };
  getUserMediaError?: Error;
}

function setupMockNavigatorMedia(options: SetupMockMediaOptions = {}) {
  let lastRequestedConstraints: MediaStreamConstraints | undefined;
  let currentTrack = new MockTrack(options.capabilities ?? { torch: true });
  let currentStream = new MockStream([currentTrack]);

  const mockDevices = options.devices || [
    {
      deviceId: "cam-back-id",
      kind: "videoinput",
      label: "Back Camera",
      groupId: "group-1",
    },
    {
      deviceId: "cam-front-id",
      kind: "videoinput",
      label: "Front Camera",
      groupId: "group-1",
    },
  ];

  const mockGetUserMedia = async (constraints?: MediaStreamConstraints) => {
    lastRequestedConstraints = constraints;
    if (options.getUserMediaError) {
      throw options.getUserMediaError;
    }
    currentTrack = new MockTrack(options.capabilities ?? { torch: true });
    currentStream = new MockStream([currentTrack]);
    return currentStream as unknown as MediaStream;
  };

  const mockEnumerateDevices = async () => {
    return mockDevices as unknown as MediaDeviceInfo[];
  };

  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: mockEnumerateDevices,
      },
    },
    writable: true,
    configurable: true,
  });

  return {
    restore: () => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    },
    getLastConstraints: () => lastRequestedConstraints,
    getCurrentTrack: () => currentTrack,
    getCurrentStream: () => currentStream,
  };
}

// --- Tests ---

test("useCameraStream: initializes with default idle state when autoStart is false", () => {
  const mockMedia = setupMockNavigatorMedia();
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    assert.equal(result.current.stream, null);
    assert.equal(result.current.isActive, false);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, null);
    assert.equal(result.current.facingMode, "environment");
    assert.equal(result.current.hasTorch, false);
    assert.equal(result.current.isTorchOn, false);
    assert.deepEqual(result.current.devices, []);
    assert.equal(result.current.selectedDeviceId, null);

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: startCamera successfully acquires stream, binds videoRef, and enumerates devices", async () => {
  const mockMedia = setupMockNavigatorMedia({
    capabilities: { torch: true },
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    let played = false;
    const fakeVideo = {
      srcObject: null as unknown,
      play: async () => {
        played = true;
      },
    } as unknown as HTMLVideoElement;

    // Attach video element to ref
    (result.current.videoRef as { current: HTMLVideoElement | null }).current =
      fakeVideo;

    await result.current.startCamera();

    assert.equal(result.current.isActive, true);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, null);
    assert.ok(result.current.stream !== null);
    assert.equal(fakeVideo.srcObject, result.current.stream);
    assert.equal(played, true);
    assert.equal(result.current.hasTorch, true);
    assert.equal(result.current.isTorchOn, false);
    assert.equal(result.current.devices.length, 2);

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: stopCamera stops all tracks, detaches videoRef, and resets state", async () => {
  const mockMedia = setupMockNavigatorMedia();
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    const fakeVideo = {
      srcObject: null as unknown,
      play: async () => {},
    } as unknown as HTMLVideoElement;
    (result.current.videoRef as { current: HTMLVideoElement | null }).current =
      fakeVideo;

    await result.current.startCamera();
    assert.equal(result.current.isActive, true);

    const stream = result.current.stream!;
    const tracks = stream.getTracks();

    result.current.stopCamera();

    assert.equal(result.current.isActive, false);
    assert.equal(result.current.stream, null);
    assert.equal(result.current.hasTorch, false);
    assert.equal(result.current.isTorchOn, false);
    assert.equal(fakeVideo.srcObject, null);
    tracks.forEach((t) => {
      assert.equal(t.readyState, "ended");
    });

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: switchCamera flips facingMode between environment and user", async () => {
  const mockMedia = setupMockNavigatorMedia({
    devices: [], // No multi-camera deviceIds, triggers facingMode flip
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false, facingMode: "environment" })
    );

    await result.current.startCamera();
    assert.equal(result.current.facingMode, "environment");

    await result.current.switchCamera();
    assert.equal(result.current.facingMode, "user");
    const lastConstraints = mockMedia.getLastConstraints() as {
      video?: { facingMode?: { ideal?: string } };
    };
    assert.equal(lastConstraints.video?.facingMode?.ideal, "user");

    await result.current.switchCamera();
    assert.equal(result.current.facingMode, "environment");

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: switchCamera cycles through available camera devices", async () => {
  const mockMedia = setupMockNavigatorMedia({
    devices: [
      {
        deviceId: "dev-back",
        kind: "videoinput",
        label: "Back",
        groupId: "g1",
      },
      {
        deviceId: "dev-front",
        kind: "videoinput",
        label: "Front",
        groupId: "g1",
      },
    ],
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();
    // Default camera selected (first or based on facingMode)
    await result.current.switchCamera();
    assert.equal(result.current.selectedDeviceId, "dev-front");

    await result.current.switchCamera();
    assert.equal(result.current.selectedDeviceId, "dev-back");

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: selectDevice sets selectedDeviceId and starts camera with exact deviceId", async () => {
  const mockMedia = setupMockNavigatorMedia({
    devices: [
      {
        deviceId: "cam-custom",
        kind: "videoinput",
        label: "Custom Cam",
        groupId: "g1",
      },
    ],
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.selectDevice("cam-custom");
    assert.equal(result.current.selectedDeviceId, "cam-custom");
    const lastConstraints = mockMedia.getLastConstraints() as {
      video?: { deviceId?: { exact?: string } };
    };
    assert.equal(lastConstraints.video?.deviceId?.exact, "cam-custom");

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: toggleTorch turns torch on and off via track constraints", async () => {
  const mockMedia = setupMockNavigatorMedia({
    capabilities: { torch: true },
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();
    assert.equal(result.current.hasTorch, true);
    assert.equal(result.current.isTorchOn, false);

    await result.current.toggleTorch();
    assert.equal(result.current.isTorchOn, true);
    const track = mockMedia.getCurrentTrack();
    assert.deepEqual(track.appliedConstraints, {
      advanced: [{ torch: true }],
    });

    await result.current.toggleTorch();
    assert.equal(result.current.isTorchOn, false);
    assert.deepEqual(track.appliedConstraints, {
      advanced: [{ torch: false }],
    });

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: toggleTorch is no-op when torch is not supported", async () => {
  const mockMedia = setupMockNavigatorMedia({
    capabilities: { torch: false },
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();
    assert.equal(result.current.hasTorch, false);

    await result.current.toggleTorch();
    assert.equal(result.current.isTorchOn, false);

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: sets friendly error when permission is denied", async () => {
  const deniedError = new Error("Permission denied by user");
  deniedError.name = "NotAllowedError";

  const mockMedia = setupMockNavigatorMedia({
    getUserMediaError: deniedError,
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();

    assert.equal(result.current.isActive, false);
    assert.equal(result.current.isLoading, false);
    assert.ok(result.current.error !== null);
    assert.ok(
      result.current.error.includes("อนุญาต") ||
        result.current.error.includes("Permission")
    );

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: sets friendly error when no camera device is found", async () => {
  const notFoundError = new Error("Requested device not found");
  notFoundError.name = "NotFoundError";

  const mockMedia = setupMockNavigatorMedia({
    getUserMediaError: notFoundError,
  });
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();

    assert.equal(result.current.isActive, false);
    assert.equal(result.current.isLoading, false);
    assert.ok(result.current.error !== null);
    assert.ok(result.current.error.includes("ไม่พบอุปกรณ์"));

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: sets friendly error when mediaDevices is unsupported", async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: {},
    writable: true,
    configurable: true,
  });

  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();

    assert.equal(result.current.isActive, false);
    assert.ok(result.current.error !== null);
    assert.ok(result.current.error.includes("ไม่รองรับ"));

    unmount();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  }
});

test("useCameraStream: autoStart triggers camera start on mount", async () => {
  const mockMedia = setupMockNavigatorMedia();
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: true })
    );

    // Give microtasks a turn to resolve async startCamera in useEffect
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(result.current.isActive, true);
    assert.ok(result.current.stream !== null);

    unmount();
  } finally {
    mockMedia.restore();
  }
});

test("useCameraStream: unmounting stops all active tracks cleanly", async () => {
  const mockMedia = setupMockNavigatorMedia();
  try {
    const { result, unmount } = renderHook(() =>
      useCameraStream({ autoStart: false })
    );

    await result.current.startCamera();
    const stream = result.current.stream!;
    const tracks = stream.getTracks();

    unmount();

    tracks.forEach((t) => {
      assert.equal(t.readyState, "ended");
    });
  } finally {
    mockMedia.restore();
  }
});
