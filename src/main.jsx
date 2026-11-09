import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { GlassSystemProvider } from "open-glass-ui";
import App from "./App.jsx";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary.jsx";
import { initGlobalErrorListeners } from "./services/errorLogger.js";

// Initialize global window.onerror and window.onunhandledrejection error interceptors
initGlobalErrorListeners();

// Register Service Worker for external desktop web notifications
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
	const registerSW = () => {
		navigator.serviceWorker
			.register("/sw.js")
			.then((reg) => {
				console.log("[ServiceWorker] Registered successfully:", reg.scope);
			})
			.catch((err) => {
				console.warn("[ServiceWorker] Registration failed:", err);
			});
	};

	if (
		document.readyState === "complete" ||
		document.readyState === "interactive"
	) {
		registerSW();
	} else {
		window.addEventListener("load", registerSW);
	}
}

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<GlobalErrorBoundary>
			<GlassSystemProvider
				theme={{
					appearance: "dark",
					defaultAppearance: "dark",
					design: "liquid",
					theme: {
						accent: "#38bdf8",
						glass: "liquid",
					},
					style: { minHeight: "100vh", width: "100%" },
				}}
				design="liquid"
				quality="high"
			>
				<App />
			</GlassSystemProvider>
		</GlobalErrorBoundary>
	</StrictMode>,
);
