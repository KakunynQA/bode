// React DevTools is only used by Ink when DEV=true. We are a CLI bundle,
// never that branch — stub it so the browser-only react-devtools-core
// package is never evaluated.
export default function connectToDevTools() {
	// no-op
}
