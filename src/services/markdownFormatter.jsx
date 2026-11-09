import React from "react";

/**
 * Parses inline markdown tokens statically: **bold**, *italic*, `code`, [link](url).
 */
export function parseInlineMarkdownStatic(text) {
	if (!text) return "";

	const parts = [];
	const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
	let lastIndex = 0;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}

		const token = match[0];
		if (token.startsWith("**") && token.endsWith("**")) {
			parts.push(
				<strong
					key={match.index}
					style={{ fontWeight: "700", color: "#ffffff" }}
				>
					{token.slice(2, -2)}
				</strong>,
			);
		} else if (token.startsWith("*") && token.endsWith("*")) {
			parts.push(
				<em
					key={match.index}
					style={{ fontStyle: "italic", color: "var(--text-primary)" }}
				>
					{token.slice(1, -1)}
				</em>,
			);
		} else if (token.startsWith("`") && token.endsWith("`")) {
			parts.push(
				<code
					key={match.index}
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.08)",
						padding: "2px 6px",
						borderRadius: "4px",
						fontSize: "0.88em",
						color: "var(--status-on-time)",
					}}
				>
					{token.slice(1, -1)}
				</code>,
			);
		} else if (token.startsWith("[") && token.includes("](")) {
			const labelMatch = token.match(/\[(.*?)\]\((.*?)\)/);
			if (labelMatch) {
				parts.push(
					<a
						key={match.index}
						href={labelMatch[2]}
						target="_blank"
						rel="noopener noreferrer"
						style={{ color: "#ffffff", textDecoration: "underline" }}
					>
						{labelMatch[1]}
					</a>,
				);
			}
		}

		lastIndex = regex.lastIndex;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts;
}

/**
 * Parses inline markdown with word-fade-in class during typewriter streaming.
 */
export function parseInlineMarkdown(text, isTyping = false) {
	if (!text) return "";
	if (!isTyping) return parseInlineMarkdownStatic(text);

	const tokens = text.split(/(\s+)/);
	return tokens.map((w, idx) => {
		if (!w) return null;
		if (/^\s+$/.test(w)) return <span key={idx}>{w}</span>;
		return (
			<span key={idx} className="word-fade-in">
				{parseInlineMarkdownStatic(w)}
			</span>
		);
	});
}

/**
 * Formats multi-line markdown text with headers, numbered/bulleted lists, and paragraphs.
 */
export function formatMarkdownText(rawText, isTyping = false) {
	if (!rawText) return null;

	// Pre-normalize squished list items like " 1. **" or " 2. **" that have no newlines before them
	const text = String(rawText)
		.replace(/([^\n])\s+(\d+\.\s+\*\*)/g, "$1\n\n$2")
		.replace(/([^\n])\s+(\d+\.\s+[^\d\s])/g, "$1\n$2");

	const lines = text.split("\n");
	const elements = [];

	lines.forEach((line, lineIdx) => {
		const trimmed = line.trim();

		if (trimmed.startsWith("### ")) {
			elements.push(
				<h4
					key={lineIdx}
					style={{
						fontSize: "1.05rem",
						fontWeight: "700",
						margin: "12px 0 6px 0",
						color: "var(--status-on-time)",
					}}
				>
					{parseInlineMarkdown(trimmed.slice(4), isTyping)}
				</h4>,
			);
			return;
		}
		if (trimmed.startsWith("## ")) {
			elements.push(
				<h3
					key={lineIdx}
					style={{
						fontSize: "1.15rem",
						fontWeight: "700",
						margin: "14px 0 8px 0",
						color: "#ffffff",
					}}
				>
					{parseInlineMarkdown(trimmed.slice(3), isTyping)}
				</h3>,
			);
			return;
		}
		if (trimmed.startsWith("# ")) {
			elements.push(
				<h2
					key={lineIdx}
					style={{
						fontSize: "1.25rem",
						fontWeight: "700",
						margin: "16px 0 10px 0",
						color: "#ffffff",
					}}
				>
					{parseInlineMarkdown(trimmed.slice(2), isTyping)}
				</h2>,
			);
			return;
		}

		// Numbered list: "1. ", "2. ", etc.
		const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
		if (numMatch) {
			elements.push(
				<div
					key={lineIdx}
					style={{
						display: "flex",
						gap: "8px",
						margin: "6px 0",
						alignItems: "flex-start",
						lineHeight: "1.65",
					}}
				>
					<span
						style={{
							fontWeight: "700",
							color: "var(--status-on-time)",
							minWidth: "22px",
						}}
					>
						{numMatch[1]}.
					</span>
					<span style={{ flex: 1 }}>
						{parseInlineMarkdown(numMatch[2], isTyping)}
					</span>
				</div>,
			);
			return;
		}

		// Bullet list: "- ", "* "
		if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
			elements.push(
				<div
					key={lineIdx}
					style={{
						display: "flex",
						gap: "8px",
						margin: "4px 0",
						alignItems: "flex-start",
						lineHeight: "1.65",
					}}
				>
					<span style={{ color: "var(--status-on-time)", fontWeight: "bold" }}>
						•
					</span>
					<span style={{ flex: 1 }}>
						{parseInlineMarkdown(trimmed.slice(2), isTyping)}
					</span>
				</div>,
			);
			return;
		}

		// Empty line -> spacing
		if (!trimmed) {
			elements.push(<div key={lineIdx} style={{ height: "6px" }} />);
			return;
		}

		// Regular paragraph
		elements.push(
			<p key={lineIdx} style={{ margin: "4px 0", lineHeight: "1.7" }}>
				{parseInlineMarkdown(line, isTyping)}
			</p>,
		);
	});

	return elements;
}
