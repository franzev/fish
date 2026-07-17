// Calls is the one-to-one audio/video calling feature: the calm call surface
// (a state-for-state mirror of the web `CallPopoverView`), the
// `@Observable` session orchestrator ported from the web `CallProvider`, and
// the feature-local media port. Control-plane providers come from CallData;
// the LiveKit media adapter lives in CallMediaLiveKit and reaches this module
// only through `CallMediaProviding` at the app boundary.
