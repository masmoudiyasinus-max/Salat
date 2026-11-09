import {
	BookMarked,
	Bookmark,
	BookOpen,
	FileText,
	Upload,
	X,
} from "lucide-react";
import { Button, Glass, IconButton } from "open-glass-ui";
import React from "react";

export default function BookLibraryShelf({
	booksList = [],
	activeBook = null,
	currentPage = 1,
	totalPages = 0,
	isLoadingPdf = false,
	isDraggingOver = false,
	fileInputRef,
	onFileUpload,
	onOpenReader,
	onSelectBook,
	onDeleteBook,
	onDragOver,
	onDragLeave,
	onDrop,
	isEn = false,
}) {
	return (
		<Glass
			as="section"
			material="regular"
			look={{
				blur: 1.4,
				opacity: 0.38,
				rim: 1.5,
				highlight: 1.6,
				lensing: 1.6,
				lightAngle: 340,
			}}
			style={{
				padding: "30px 34px",
				borderRadius: "28px",
				border: "1px solid rgba(255, 255, 255, 0.16)",
				boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: "16px",
					marginBottom: "20px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<div
						style={{
							padding: "8px",
							backgroundColor: "rgba(255, 255, 255, 0.12)",
							border: "var(--card-border-width) solid var(--card-border-color)",
							borderRadius: "var(--radius-sm)",
							color: "var(--status-on-time)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<BookMarked size={20} />
					</div>
					<div>
						<h3
							style={{
								fontSize: "1.2rem",
								fontWeight: "700",
								margin: 0,
								color: "var(--text-primary)",
							}}
						>
							{isEn ? "Current Book & Library" : "الكتاب الحالي والمكتبة"}
						</h3>
						<p
							style={{
								fontSize: "0.82rem",
								color: "var(--text-secondary)",
								margin: "3px 0 0 0",
							}}
						>
							{isEn
								? "Local-first zero data loss library saved directly in your browser."
								: "مكتبتك المحفوظة محلياً بالكامل في المتصفح مع حفظ تلقائي لصفحة التوقف."}
						</p>
					</div>
				</div>

				{/* Upload Button */}
				<div>
					<input
						type="file"
						ref={fileInputRef}
						onChange={onFileUpload}
						accept=".pdf,application/pdf"
						style={{ display: "none" }}
					/>
					<Button
						variant="primary"
						size="medium"
						onClick={() => fileInputRef?.current?.click()}
						disabled={isLoadingPdf}
					>
						<Upload size={15} />
						<span>{isEn ? "Upload PDF Book" : "رفع كتاب من الجهاز"}</span>
					</Button>
				</div>
			</div>

			{/* Active Book Showcase Card */}
			{activeBook ? (
				<div
					className="sub-glass-card"
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: "16px",
						padding: "16px 20px",
						borderRadius: "12px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
						<div
							style={{
								width: "44px",
								height: "54px",
								borderRadius: "8px",
								backgroundColor: "rgba(255, 255, 255, 0.08)",
								border:
									"var(--card-border-width) solid var(--card-border-color)",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								color: "var(--text-primary)",
							}}
						>
							<FileText size={20} />
							<span
								style={{
									fontSize: "0.62rem",
									color: "var(--text-secondary)",
									marginTop: "2px",
								}}
							>
								PDF
							</span>
						</div>

						<div>
							<h4
								style={{
									fontSize: "1.05rem",
									fontWeight: "700",
									margin: 0,
									color: "var(--text-primary)",
								}}
							>
								{activeBook.name}
							</h4>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
									fontSize: "0.80rem",
									color: "var(--text-secondary)",
									marginTop: "3px",
								}}
							>
								<span
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: "4px",
										color: "var(--status-on-time)",
									}}
								>
									<Bookmark size={13} />
									{isEn
										? `Last Read: Page ${currentPage}`
										: `آخر صفحة قرأتها: ${currentPage}`}
								</span>
								<span>•</span>
								<span>
									{totalPages} {isEn ? "pages" : "صفحة"}
								</span>
								<span>•</span>
								<span>{activeBook.size}</span>
							</div>
						</div>
					</div>

					{/* Start Reading Action Button */}
					<Button
						variant="primary"
						size="medium"
						onClick={onOpenReader}
					>
						<BookOpen size={16} />
						<span>
							{currentPage > 1
								? isEn
									? `Continue (Page ${currentPage})`
									: `متابعة القراءة (صفحة ${currentPage})`
								: isEn
									? "Start Reading"
									: "بدء القراءة"}
						</span>
					</Button>
				</div>
			) : (
				<div
					onClick={() => fileInputRef?.current?.click()}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
					className="sub-glass-card"
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						width: "100%",
						padding: "36px 20px",
						borderRadius: "12px",
						border: isDraggingOver
							? "var(--card-border-width) dashed var(--card-border-highlight) !important"
							: "var(--card-border-width) dashed var(--card-border-color) !important",
						backgroundColor: isDraggingOver
							? "rgba(255, 255, 255, 0.12) !important"
							: "rgba(18, 18, 18, 0.65) !important",
						cursor: "pointer",
						textAlign: "center",
						boxShadow: isDraggingOver
							? "0 4px 12px rgba(0, 0, 0, 0.25)"
							: "none",
					}}
				>
					<Upload
						size={36}
						style={{
							color: isDraggingOver
								? "var(--status-on-time)"
								: "var(--text-secondary)",
							marginBottom: "12px",
							transition: "color 0.2s ease, transform 0.2s ease",
							transform: isDraggingOver ? "scale(1.15)" : "scale(1)",
						}}
					/>
					<span
						style={{
							fontSize: "1rem",
							fontWeight: "700",
							color: "var(--text-primary)",
							marginBottom: "4px",
							textAlign: "center",
						}}
					>
						{isDraggingOver
							? isEn
								? "Drop PDF book here"
								: "أسقط ملف الكتاب هنا فورياً"
							: isEn
								? "Drag & drop your PDF book here"
								: "قم بسحب وإسقاط ملف الكتاب هنا"}
					</span>
					<span
						style={{
							fontSize: "0.82rem",
							color: "var(--text-muted)",
							textAlign: "center",
						}}
					>
						{isEn
							? "Or click here to select a book from your device (saved locally)"
							: "أو انقر هنا لاستعراض واختيار الكتاب من جهازك (يُحفظ محلياً)"}
					</span>
				</div>
			)}

			{/* Multiple Books Shelf (if more than 1 uploaded) */}
			{booksList.length > 1 && (
				<div style={{ marginTop: "18px" }}>
					<h5
						style={{
							fontSize: "0.82rem",
							color: "var(--text-secondary)",
							marginBottom: "8px",
						}}
					>
						{isEn ? "Other Saved Books:" : "كتب أخرى محفوظة في مكتبتك:"}
					</h5>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
							gap: "8px",
						}}
					>
						{booksList.map((b) => (
							<div
								key={b.id}
								onClick={() => onSelectBook(b.id)}
								className="sub-glass-card"
								style={{
									padding: "8px 12px",
									borderRadius: "var(--radius-sm)",
									backgroundColor:
										activeBook?.id === b.id
											? "rgba(255, 255, 255, 0.12) !important"
											: "rgba(18, 18, 18, 0.75) !important",
									border:
										"var(--card-border-width) solid var(--card-border-color)",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									cursor: "pointer",
								}}
							>
								<span
									style={{
										fontSize: "0.82rem",
										fontWeight: "600",
										color: "var(--text-primary)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										maxWidth: "140px",
									}}
								>
									{b.name}
								</span>
								<IconButton
									variant="quiet"
									size="small"
									onClick={(e) => onDeleteBook(b.id, e)}
									aria-label={isEn ? "Delete" : "حذف"}
								>
									<X size={13} />
								</IconButton>
							</div>
						))}
					</div>
				</div>
			)}
		</Glass>
	);
}
