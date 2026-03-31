import { NativeModules } from 'react-native';

type WebRTCModuleShape = {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: {
    getUserMedia: (constraints: { audio: boolean; video: boolean }) => Promise<any>;
  };
  registerGlobals?: () => void;
};

let cachedModule: WebRTCModuleShape | null = null;

export async function loadWebRTCModule(): Promise<WebRTCModuleShape> {
  if (cachedModule) return cachedModule;
  const nativeModule = (NativeModules as any)?.WebRTCModule;
  if (!nativeModule) {
    throw new Error("WebRTC natif indisponible. Utilisez un dev build Selix, pas Expo Go.");
  }
  const module = await import('react-native-webrtc');
  module.registerGlobals?.();
  cachedModule = module as unknown as WebRTCModuleShape;
  return cachedModule;
}

export async function createLocalAudioStream() {
  const webrtc = await loadWebRTCModule();
  return webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function createAudioPeerConnection(
  webrtc: WebRTCModuleShape,
  handlers: {
    onIceCandidate?: (candidate: any) => void;
    onTrack?: (event: any) => void;
  },
) {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  peer.onicecandidate = (event: any) => {
    if (event?.candidate) handlers.onIceCandidate?.(event.candidate);
  };
  peer.ontrack = (event: any) => {
    handlers.onTrack?.(event);
  };

  return peer;
}

export async function stopMediaStream(stream: any) {
  if (!stream?.getTracks) return;
  stream.getTracks().forEach((track: any) => {
    try {
      track.stop?.();
    } catch {}
  });
}
