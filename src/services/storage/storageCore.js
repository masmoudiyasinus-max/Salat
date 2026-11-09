/**
 * Storage Core Utilities
 * Centrally manages localStorage operations with QuotaExceededError handling and image compression.
 */

/**
 * Asynchronously compresses an image file/Blob to target dimensions & quality using Canvas.
 * Prevents localStorage QuotaExceededError by reducing multi-megabyte images to ~50-150KB.
 */
export async function compressImageFile(
	file,
	maxWidth = 1920,
	maxHeight = 1080,
	quality = 0.75,
) {
	if (!file) return null;
	return new Promise((resolve) => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			resolve(null);
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				let width = img.width;
				let height = img.height;

				if (width > maxWidth || height > maxHeight) {
					const ratio = Math.min(maxWidth / width, maxHeight / height);
					width = Math.round(width * ratio);
					height = Math.round(height * ratio);
				}

				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					resolve(e.target.result);
					return;
				}

				ctx.drawImage(img, 0, 0, width, height);

				let compressedDataUrl = "";
				try {
					compressedDataUrl = canvas.toDataURL("image/webp", quality);
					if (!compressedDataUrl.startsWith("data:image/webp")) {
						compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
					}
				} catch {
					compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
				}

				resolve(compressedDataUrl || e.target.result);
			};
			img.onerror = () => resolve(e.target.result);
			img.src = e.target.result;
		};
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(file);
	});
}

/**
 * Centrally manages localStorage.setItem with automatic QuotaExceededError handling & recovery.
 */
export function safeSetLocalStorageItem(
	key,
	valueString,
	retryStrategy = null,
) {
	if (typeof localStorage === "undefined") return false;
	try {
		localStorage.setItem(key, valueString);
		return true;
	} catch (err) {
		console.warn(
			`localStorage quota exceeded while saving "${key}". Initiating safe recovery.`,
			err,
		);
		if (typeof retryStrategy === "function") {
			try {
				const recoveredValue = retryStrategy();
				if (recoveredValue !== undefined) {
					localStorage.setItem(
						key,
						typeof recoveredValue === "string"
							? recoveredValue
							: JSON.stringify(recoveredValue),
					);
					return true;
				}
			} catch (retryErr) {
				console.error(`Quota recovery failed for "${key}":`, retryErr);
			}
		}
		return false;
	}
}
