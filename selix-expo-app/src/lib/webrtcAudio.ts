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
const EXPO_GO_MESSAGE = "Audio temps reel indisponible dans Expo Go. Utilisez la messagerie ou un dev build pour l'appel audio.";

export async function loadWebRTCModule(): Promise<WebRTCModuleShape> {
  if (cachedModule) return cachedModule;
  throw new Error(EXPO_GO_MESSAGE);
}

export async function createLocalAudioStream() {
  throw new Error(EXPO_GO_MESSAGE);
}

export function createAudioPeerConnection(
  _webrtc: WebRTCModuleShape,
  handlers: {
    onIceCandidate?: (candidate: any) => void;
    onTrack?: (event: any) => void;
  },
) {
  void handlers;
  throw new Error(EXPO_GO_MESSAGE);
}

export async function stopMediaStream(stream: any) {
  if (!stream?.getTracks) return;
  stream.getTracks().forEach((track: any) => {
    try {
      track.stop?.();
    } catch {}
  });
}
