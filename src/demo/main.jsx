import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
	GlassSystemProvider,
	Glass,
	Button,
	Switch,
	Slider,
	SegmentedControl,
} from "open-glass-ui";
import "open-glass-ui/styles.css";
import "./demo.css";

function OpenGlassShowcase() {
	const [activeSegment, setActiveSegment] = useState("list");
	const [spatialAudio, setSpatialAudio] = useState(true);
	const [crossfade, setCrossfade] = useState(false);
	const [volume, setVolume] = useState(96);
	const [progress, setProgress] = useState(74);
	const [lookPreset, setLookPreset] = useState("liquid");
	const [lightAngle, setLightAngle] = useState(359);
	const [bgMode, setBgMode] = useState("gradient"); // 'gradient' | 'live'

	return (
		<GlassSystemProvider
			theme={{
				appearance: "dark",
				defaultAppearance: "dark",
				design: "liquid",
				theme: {
					accent: "#818cf8", // Signature periwinkle cobalt
					glass: lookPreset,
				},
				style: { minHeight: "100vh", width: "100%" },
			}}
			design="liquid"
			quality="high"
		>
			<div className={`demo-stage ${bgMode === "live" ? "stage-live" : "stage-gradient"}`}>
				{/* Live Video Background Mode (for direct side-by-side comparison) */}
				{bgMode === "live" && (
					<iframe
						className="demo-live-bg"
						src="https://www.youtube-nocookie.com/embed/7Co8BMbbbWk?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1"
						title="Live Stream Background"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					/>
				)}

				{/* Top Left Design Badge */}
				<div className="demo-badge-top-left">
					<span className="demo-liquid-pill">LIQUID</span>
				</div>

				{/* Top Center Floating Navigation Bar */}
				<header className="demo-top-nav-container">
					<Glass
						material="regular"
						className="demo-nav-capsule"
						look={{ lightAngle }}
					>
						<button className="demo-nav-plus-btn" aria-label="Add">
							+
						</button>
						<div className="demo-segments-wrapper">
							<SegmentedControl
								aria-label="View mode"
								items={[
									{ value: "grid", label: "Grid" },
									{ value: "list", label: "List" },
									{ value: "mixes", label: "Mixes" },
								]}
								value={activeSegment}
								onValueChange={setActiveSegment}
							/>
						</div>
					</Glass>
				</header>

				{/* Center Showcase Scene */}
				<main className="demo-center-scene">
					{/* The Star: Center Floating Liquid Glass Card */}
					<Glass
						as="section"
						material="regular"
						interactive={true}
						look={{
							preset: lookPreset,
							lightAngle,
							blur: 1.4,
							opacity: 0.38,
							rim: 1.5,
							highlight: 1.6,
							lensing: 1.6,
						}}
						className="demo-main-glass-card"
					>
						<div className="demo-card-body">
							{/* Row 1: Spatial Audio Switch */}
							<Switch
								label="Spatial audio"
								description="Head-tracked"
								checked={spatialAudio}
								onCheckedChange={setSpatialAudio}
							/>

							{/* Row 2: Crossfade Switch */}
							<Switch
								label="Crossfade"
								checked={crossfade}
								onCheckedChange={setCrossfade}
							/>

							{/* Row 3: Official Native OpenGlass Volume Slider */}
							<Slider
								label="Volume"
								unit="%"
								min={0}
								max={100}
								value={volume}
								onChange={(e) => setVolume(Number(e.currentTarget.value))}
							/>

							{/* Row 4: Action Buttons */}
							<div className="demo-buttons-row">
								<Button
									variant="primary"
									size="medium"
									onClick={() => alert("Added to library!")}
									className="demo-btn-primary"
								>
									Add to library
								</Button>
								<Button
									variant="secondary"
									size="medium"
									onClick={() => alert("Share clicked!")}
									className="demo-btn-secondary"
								>
									Share
								</Button>
							</div>
						</div>
					</Glass>
				</main>

				{/* Bottom Floating Media Player Bar */}
				<footer className="demo-bottom-player-container">
					<Glass
						material="regular"
						className="demo-player-capsule"
						look={{ lightAngle, rim: 1.4 }}
					>
						{/* Album Art Mini Gradient */}
						<div className="demo-player-art" />

						{/* Pause Button */}
						<button className="demo-player-pause-btn" aria-label="Pause">
							<span className="pause-bar" />
							<span className="pause-bar" />
						</button>

						{/* Progress Seeker */}
						<div className="demo-player-seeker-wrap ogui-media" style={{ "--ogui-range-progress": progress / 100 }}>
							<input
								type="range"
								min="0"
								max="100"
								value={progress}
								onChange={(e) => setProgress(Number(e.target.value))}
							/>
						</div>

						{/* Time Display */}
						<div className="demo-player-time">2:36 / 3:32</div>
					</Glass>
				</footer>

				{/* Interactive Demo Toolbar: Switch Presets, Light Angle, and Background */}
				<div className="demo-interactive-inspector">
					<div className="inspector-panel">
						{/* Preset Switcher */}
						<div className="inspector-group">
							<span className="inspector-label">Glass Look:</span>
							<div className="inspector-pills">
								{["liquid", "frosted", "clear", "smoked", "lensed"].map((preset) => (
									<button
										key={preset}
										className={`inspector-pill ${lookPreset === preset ? "active" : ""}`}
										onClick={() => setLookPreset(preset)}
									>
										{preset.charAt(0).toUpperCase() + preset.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Light Angle Slider */}
						<div className="inspector-group">
							<span className="inspector-label">Light direction: {lightAngle}°</span>
							<input
								type="range"
								min="0"
								max="360"
								value={lightAngle}
								onChange={(e) => setLightAngle(Number(e.target.value))}
								className="inspector-range"
							/>
						</div>

						{/* Live Comparison Switcher */}
						<div className="inspector-group">
							<span className="inspector-label">Background Reality Test:</span>
							<div className="inspector-pills">
								<button
									className={`inspector-pill ${bgMode === "gradient" ? "active" : ""}`}
									onClick={() => setBgMode("gradient")}
								>
									🎨 Neon Mesh (Official Demo)
								</button>
								<button
									className={`inspector-pill ${bgMode === "live" ? "active" : ""}`}
									onClick={() => setBgMode("live")}
								>
									📹 Mosque Live Stream
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</GlassSystemProvider>
	);
}

const rootElement = document.getElementById("demo-root");
if (rootElement) {
	createRoot(rootElement).render(<OpenGlassShowcase />);
}
