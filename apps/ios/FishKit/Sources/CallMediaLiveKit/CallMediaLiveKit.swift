// CallMediaLiveKit is the production media adapter: the LiveKit Swift SDK
// behind the feature's `CallMediaProviding` port. It is the only FishKit
// target that links WebRTC, and only the app boundary constructs it — the
// Calls feature and its tests never import LiveKit.
