import { Sparkles } from "lucide-react";
import React from "react";

export default function PdfCanvasViewer({
	canTurnNext = true,
	todayLog = { completed: false },
	onNextPage,
	onPrevPage,
	readerContainerRef,
	ambientCanvasRef,
	rightPageCanvasRef,
	leftPageCanvasRef,
	ambientBrightnessScale = 1.0,
	canvasBgColor = "transparent",
	canvasFilter = "none",
	themeBackdropStyle = "#0a0a0a",
	isLoadingPdf = false,
	isEn = false,
}) {
	return (
		<div
			ref={readerContainerRef}
			style={{
				position: "relative",
				width: "100vw",
				height: "100vh",
				overflow: "hidden",
				background: themeBackdropStyle,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				userSelect: "none",
				WebkitUserSelect: "none",
				transition: "background 0.4s ease",
			}}
		>
			{/* Seamless Click-to-Turn Navigation Overlays (Left & Right Zones) */}
			{/* Left Zone: In RTL books, clicking left advances to Next Page */}
			<div
				onClick={canTurnNext ? onNextPage : undefined}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "18%",
					height: "100%",
					cursor: canTurnNext ? "pointer" : "default",
					zIndex: 6,
				}}
				title={
					!canTurnNext && todayLog.completed
						? isEn
							? "Daily reading ward limit reached"
							: "تم الوصول لحد الورد اليومي بنجاح"
						: isEn
							? "Next Page"
							: "الصفحة التالية"
				}
			/>

			{/* Right Zone: In RTL books, clicking right goes to Previous Page */}
			<div
				onClick={onPrevPage}
				style={{
					position: "absolute",
					top: 0,
					right: 0,
					width: "18%",
					height: "100%",
					cursor: "pointer",
					zIndex: 6,
				}}
				title={isEn ? "Previous Page" : "الصفحة السابقة"}
			/>

			{/* Side-by-Side Dual Canvas Spread Layout */}
			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "row",
					direction: "rtl",
					alignItems: "center",
					justifyContent: "center",
					gap: 0,
					width: "auto",
					height: "100%",
					maxWidth: "100%",
					maxHeight: "100%",
					padding: 0,
					boxSizing: "border-box",
					zIndex: 3,
				}}
			>
				{/* Ambient Canvas */}
				<canvas
					ref={ambientCanvasRef}
					style={{
						position: "absolute",
						inset: "-50px -70px",
						width: "calc(100% + 140px)",
						height: "calc(100% + 100px)",
						filter: `brightness(${ambientBrightnessScale}) blur(60px)`,
						WebkitFilter: `brightness(${ambientBrightnessScale}) blur(60px)`,
						opacity: 0.65,
						zIndex: -1,
						pointerEvents: "none",
						transition: "opacity 0.4s ease, filter 0.4s ease",
					}}
				/>

				{/* Right Canvas (1st child in RTL -> Physical RIGHT / Page 1) */}
				<canvas
					ref={rightPageCanvasRef}
					style={{
						display: "block",
						boxShadow: "none",
						border: "none",
						outline: "none",
						borderRadius: 0,
						backgroundColor: canvasBgColor,
						filter: canvasFilter,
						WebkitFilter: canvasFilter,
						transition: "filter 0.35s ease, background-color 0.35s ease",
						maxWidth: "50vw",
						maxHeight: "100vh",
						height: "100%",
						width: "auto",
						objectFit: "contain",
						flexShrink: 1,
					}}
				/>

				{/* Left Canvas (2nd child in RTL -> Physical LEFT / Page 2) */}
				<canvas
					ref={leftPageCanvasRef}
					style={{
						display: "none",
						boxShadow: "none",
						border: "none",
						outline: "none",
						borderRadius: 0,
						backgroundColor: canvasBgColor,
						filter: canvasFilter,
						WebkitFilter: canvasFilter,
						transition: "filter 0.35s ease, background-color 0.35s ease",
						maxWidth: "50vw",
						maxHeight: "100vh",
						height: "100%",
						width: "auto",
						objectFit: "contain",
						flexShrink: 1,
					}}
				/>
			</div>

			{/* Initial Loading Spinner */}
			{isLoadingPdf && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "rgba(10, 10, 10, 0.85)",
						color: "var(--text-secondary)",
						gap: "12px",
						zIndex: 20,
					}}
				>
					<Sparkles size={28} className="spin" color="#ffffff" />
					<span
						style={{ fontSize: "0.88rem", fontWeight: "700", color: "#ffffff" }}
					>
						{isEn ? "Loading book..." : "جاري فتح وتجهيز الكتاب..."}
					</span>
				</div>
			)}
		</div>
	);
}
