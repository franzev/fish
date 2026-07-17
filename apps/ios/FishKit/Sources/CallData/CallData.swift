// CallData is the provider-neutral call control plane: the portable call
// lifecycle state machine (a verbatim port of `@fish/core/call-state`), the
// wire contracts of the `call-command` Edge Function and the `calls` table,
// and the protocols the call feature depends on. Live adapters speak plain
// HTTPS via URLSession; callers construct them only at the app boundary —
// feature code sees the protocols. This module never imports SwiftUI,
// DesignSystem, UIComponents, or any media SDK.
