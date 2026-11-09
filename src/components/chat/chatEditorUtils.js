import { compressImageFile } from "../../services/storage";

export function insertFileChipToEditor(
	editorEl,
	fileObj,
	attachedFilesMapRef,
	setHasContent,
) {
	if (!editorEl) return;
	editorEl.focus();

	const chip = document.createElement("span");
	chip.className = "inline-file-chip";
	chip.contentEditable = "false";
	chip.dir = "rtl";
	chip.setAttribute("data-file-id", fileObj.id);
	chip.setAttribute("data-file-name", fileObj.name || "");
	chip.setAttribute("data-file-size", fileObj.size || "");
	chip.setAttribute("data-file-type", fileObj.type || "");
	chip.setAttribute("data-is-image", fileObj.isImage ? "true" : "false");
	chip.style.unicodeBidi = "isolate";

	// Remove button on chip
	const removeBtn = document.createElement("button");
	removeBtn.type = "button";
	removeBtn.innerHTML =
		'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
	removeBtn.title = "إزالة";
	removeBtn.style.cssText = `
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    z-index: 2;
  `;
	removeBtn.onclick = (ev) => {
		ev.stopPropagation();
		ev.preventDefault();
		if (attachedFilesMapRef?.current) {
			delete attachedFilesMapRef.current[fileObj.id];
		}
		chip.remove();
		if (setHasContent) {
			setHasContent(
				editorEl.innerText.trim().length > 0 ||
					editorEl.querySelectorAll(".inline-file-chip").length > 0,
			);
		}
	};

	if (fileObj.isImage) {
		chip.setAttribute("data-file-content", fileObj.content || "");
		chip.style.cursor = "pointer";
		chip.title = "انقر لتكبير ومعاينة الصورة";
		const img = document.createElement("img");
		img.src = fileObj.content;
		img.alt = fileObj.name;
		img.style.cssText =
			"width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer;";
		chip.appendChild(img);

		chip.onclick = (e) => {
			if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
				e.stopPropagation();
				window.dispatchEvent(
					new CustomEvent("preview-chat-image", { detail: fileObj }),
				);
			}
		};
	} else {
		chip.style.width = "auto";
		chip.style.padding = "0 8px";
		chip.style.height = "34px";
		chip.innerHTML = `
      <span style="font-size: 0.72rem; color: #fff; display: flex; align-items: center; gap: 4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileObj.name}</span>
      </span>
    `;
	}

	chip.appendChild(removeBtn);

	// Insert chip at selection or at end without injecting extra literal spaces
	const sel = window.getSelection();
	if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
		const range = sel.getRangeAt(0);
		range.deleteContents();
		range.insertNode(chip);
		range.collapse(false);
		range.setStartAfter(chip);
		range.setEndAfter(chip);
		sel.removeAllRanges();
		sel.addRange(range);
	} else {
		editorEl.appendChild(chip);
		const range = document.createRange();
		range.setStartAfter(chip);
		range.setEndAfter(chip);
		const newSel = window.getSelection();
		newSel.removeAllRanges();
		newSel.addRange(range);
	}

	if (setHasContent) setHasContent(true);
}

export function handleEditorPaste(
	e,
	editorEl,
	attachedFilesMapRef,
	setHasContent,
) {
	const clipboardData = e.clipboardData;
	if (!clipboardData) return;

	// 1. Direct image file in clipboard (e.g. copied image or screenshot)
	const items = Array.from(clipboardData.items || []);
	const imageItem = items.find(
		(item) => item.type && item.type.startsWith("image/"),
	);

	if (imageItem) {
		e.preventDefault();
		const file = imageItem.getAsFile();
		if (file) {
			compressImageFile(file, 1000, 1000, 0.7).then((compressedContent) => {
				const content = compressedContent || "";
				const fileObj = {
					id:
						"file_" +
						Date.now() +
						"_" +
						Math.random().toString(36).substr(2, 4),
					name: file.name || "image_" + Date.now() + ".png",
					size: (file.size / 1024).toFixed(1) + " KB",
					type: file.type || "image/png",
					isImage: true,
					content: typeof content === "string" ? content : "",
				};
				if (attachedFilesMapRef?.current) {
					attachedFilesMapRef.current[fileObj.id] = fileObj;
				}
				insertFileChipToEditor(
					editorEl,
					fileObj,
					attachedFilesMapRef,
					setHasContent,
				);
			});
			return;
		}
	}

	// 2. HTML containing copied inline chips or rich elements
	const html = clipboardData.getData("text/html");
	if (
		html &&
		(html.includes("inline-file-chip") ||
			html.includes("data-file-id") ||
			html.includes("<img"))
	) {
		e.preventDefault();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		const itemsToInsert = [];
		let pendingText = "";

		const traverse = (node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				pendingText += node.nodeValue.replace(/\u200F/g, "");
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.classList && node.classList.contains("inline-file-chip")) {
					if (pendingText) {
						itemsToInsert.push({ type: "text", value: pendingText });
						pendingText = "";
					}
					const fileId =
						node.getAttribute("data-file-id") ||
						"file_" +
							Date.now() +
							"_" +
							Math.random().toString(36).substr(2, 4);
					const name = node.getAttribute("data-file-name") || "file.png";
					const size = node.getAttribute("data-file-size") || "10.0 KB";
					const type = node.getAttribute("data-file-type") || "image/png";
					const isImage =
						node.getAttribute("data-is-image") === "true" ||
						node.querySelector("img") !== null;
					const imgEl = node.querySelector("img");
					const content = imgEl
						? imgEl.src || node.getAttribute("data-file-content") || ""
						: "";

					itemsToInsert.push({
						type: "file",
						fileObj: { id: fileId, name, size, type, isImage, content },
					});
				} else if (node.tagName === "IMG") {
					if (pendingText) {
						itemsToInsert.push({ type: "text", value: pendingText });
						pendingText = "";
					}
					const src = node.getAttribute("src") || "";
					if (src) {
						itemsToInsert.push({
							type: "file",
							fileObj: {
								id:
									"file_" +
									Date.now() +
									"_" +
									Math.random().toString(36).substr(2, 4),
								name: node.getAttribute("alt") || "image.png",
								size: "50.0 KB",
								type: "image/png",
								isImage: true,
								content: src,
							},
						});
					}
				} else if (node.tagName === "BR") {
					pendingText += "\n";
				} else {
					node.childNodes.forEach(traverse);
				}
			}
		};

		doc.body.childNodes.forEach(traverse);
		if (pendingText) {
			itemsToInsert.push({ type: "text", value: pendingText });
		}

		// Clean ONLY outer leading and trailing blank linebreaks across the whole payload
		if (itemsToInsert.length > 0 && itemsToInsert[0].type === "text") {
			itemsToInsert[0].value = itemsToInsert[0].value.replace(/^[\r\n]+/, "");
			if (!itemsToInsert[0].value) itemsToInsert.shift();
		}
		if (
			itemsToInsert.length > 0 &&
			itemsToInsert[itemsToInsert.length - 1].type === "text"
		) {
			itemsToInsert[itemsToInsert.length - 1].value = itemsToInsert[
				itemsToInsert.length - 1
			].value.replace(/[\r\n]+$/, "");
			if (!itemsToInsert[itemsToInsert.length - 1].value) itemsToInsert.pop();
		}

		// Insert items cleanly in sequence, normalizing any redundant double spaces
		itemsToInsert.forEach((item) => {
			if (item.type === "text" && item.value) {
				const normalizedText = item.value.replace(/[ \t]{2,}/g, " ");
				document.execCommand("insertText", false, normalizedText);
			} else if (item.type === "file" && item.fileObj) {
				if (attachedFilesMapRef?.current) {
					attachedFilesMapRef.current[item.fileObj.id] = item.fileObj;
				}
				insertFileChipToEditor(
					editorEl,
					item.fileObj,
					attachedFilesMapRef,
					setHasContent,
				);
			}
		});

		if (setHasContent) setHasContent(true);
		return;
	}

	// 3. Plain text pasting
	const text = clipboardData.getData("text/plain");
	if (text) {
		e.preventDefault();
		const cleanText = text
			.replace(/^[\r\n]+/, "")
			.replace(/[\r\n]+$/, "")
			.replace(/[ \t]{2,}/g, " ");
		document.execCommand("insertText", false, cleanText);
		if (setHasContent) setHasContent(true);
	}
}

export function extractSegmentsFromEditor(editorEl, attachedFilesMap) {
	if (!editorEl) return [];
	const segments = [];
	let currentText = "";

	const traverse = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			currentText += node.nodeValue.replace(/\u00A0/g, " ");
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			if (node.classList && node.classList.contains("inline-file-chip")) {
				if (currentText.trim()) {
					segments.push({ type: "text", value: currentText.trim() });
					currentText = "";
				}
				const fileId = node.getAttribute("data-file-id");
				const file = attachedFilesMap[fileId];
				if (file) {
					segments.push({ type: "file", file });
				}
			} else if (node.nodeName === "BR") {
				currentText += "\n";
			} else {
				node.childNodes.forEach(traverse);
			}
		}
	};

	editorEl.childNodes.forEach(traverse);
	if (currentText.trim()) {
		segments.push({ type: "text", value: currentText.trim() });
	}

	return segments;
}
