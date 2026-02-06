import { MAX_FILE_MB } from '../constants/zefgen';

export const isValidImageType = (file: File) => ['image/jpeg', 'image/png'].includes(file.type);

export const isFileTooLarge = (file: File) => file.size > MAX_FILE_MB * 1024 * 1024;

export const convertToJpg = async (file: File) => {
    if (file.type === 'image/jpeg') return file;

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to convert image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.92
        );
    });

    return new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
};

export const loadImageFromFile = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image.'));
        };
        img.src = objectUrl;
    });

export const resizeImageToJpeg = async (file: File, maxWidth: number, maxHeight: number) => {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to convert image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.9
        );
    });

    return new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
};

export const createPreviewJpeg = async (
    file: File,
    targetWidth: number = 420,
    quality: number = 0.82
) => {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, targetWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');

    // Keep the same dark fill used elsewhere so transparent inputs don't become black/undefined.
    context.fillStyle = '#0b1020';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    const q = Math.max(0.4, Math.min(0.95, Number(quality) || 0.82));
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to render preview image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            q
        );
    });

    return new File([blob], `preview-${Date.now()}.jpg`, { type: 'image/jpeg' });
};

export const loadImageFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image.'));
        };
        img.src = objectUrl;
    });
};

export const drawImageFit = (
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
    mode: 'cover' | 'contain'
) => {
    const scale = mode === 'cover'
        ? Math.max(width / image.width, height / image.height)
        : Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;
    context.drawImage(image, dx, dy, drawWidth, drawHeight);
};

export const renderImageToJpeg = async (
    url: string,
    width: number,
    height: number,
    mode: 'cover' | 'contain'
) => {
    const image = await loadImageFromUrl(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.fillStyle = '#0b1020';
    context.fillRect(0, 0, width, height);
    drawImageFit(context, image, width, height, mode);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to render image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.92
        );
    });

    return new File([blob], `generated-${Date.now()}.jpg`, { type: 'image/jpeg' });
};

export const base64ToBlob = (b64: string, mimeType: string) => {
    const normalized = b64.replace(/\s/g, '');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
};

export const renderBlobToJpeg = async (
    blob: Blob,
    width: number,
    height: number,
    mode: 'cover' | 'contain'
) => {
    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image.'));
            img.src = objectUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Failed to create canvas.');
        context.fillStyle = '#0b1020';
        context.fillRect(0, 0, width, height);
        drawImageFit(context, image, width, height, mode);

        const outBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (!result) {
                        reject(new Error('Failed to render image.'));
                        return;
                    }
                    resolve(result);
                },
                'image/jpeg',
                0.92
            );
        });

        return new File([outBlob], `generated-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const renderBlobToJpegAutoFit = async (
    blob: Blob,
    width: number,
    height: number,
    options?: { coverRatioTolerance?: number }
) => {
    const tolerance = Math.max(0, Math.min(0.25, options?.coverRatioTolerance ?? 0.015));
    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image.'));
            img.src = objectUrl;
        });

        const targetRatio = width / height;
        const imageRatio = image.width / image.height;
        const ratioDiff = Math.abs(imageRatio - targetRatio) / targetRatio;
        const mode: 'cover' | 'contain' = ratioDiff <= tolerance ? 'cover' : 'contain';

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Failed to create canvas.');
        context.fillStyle = '#0b1020';
        context.fillRect(0, 0, width, height);
        drawImageFit(context, image, width, height, mode);

        const outBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (!result) {
                        reject(new Error('Failed to render image.'));
                        return;
                    }
                    resolve(result);
                },
                'image/jpeg',
                0.92
            );
        });

        return new File([outBlob], `generated-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

const splitLines = (text: string) => String(text ?? '').split('\n');

export const drawTextLayerToContext = (payload: {
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
    layer: {
        text: string;
        font: string;
        size: number;
        color: string;
        x: number;
        y: number;
        rotation: number;
        align: 'left' | 'center' | 'right';
        weight: number;
    };
}) => {
    const { context, width, height, layer } = payload;
    const text = String(layer.text ?? '');
    if (!text.replace(/\s/g, '').length) return;

    const px = (Math.max(0, Math.min(100, layer.x ?? 50)) / 100) * width;
    const py = (Math.max(0, Math.min(100, layer.y ?? 50)) / 100) * height;
    const rotation = ((layer.rotation ?? 0) * Math.PI) / 180;

    context.save();
    context.translate(px, py);
    context.rotate(rotation);

    const fontSize = Math.max(8, Number(layer.size) || 24);
    const fontWeight = Math.max(100, Math.min(900, Number(layer.weight) || 600));
    const family = layer.font || 'sans-serif';
    context.font = `${fontWeight} ${fontSize}px ${family}`;
    context.fillStyle = layer.color || '#ffffff';
    context.textBaseline = 'middle';

    const sh = (layer as any).shadow;
    const ol = (layer as any).outline;
    const outlineEnabled = Boolean(ol?.enabled && (Number(ol.width) || 0) > 0);

    const lines = splitLines(text);
    const lineHeight = Math.round(fontSize * 1.15);
    const totalHeight = lineHeight * lines.length;

    if (layer.align === 'left') context.textAlign = 'left';
    else if (layer.align === 'right') context.textAlign = 'right';
    else context.textAlign = 'center';

    const startY = -totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
        const y = startY + i * lineHeight;
        const line = lines[i];
        if (outlineEnabled) {
            // Draw outline without shadow so it stays crisp and width is visible.
            context.save();
            context.shadowColor = 'transparent';
            context.shadowBlur = 0;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
            context.lineJoin = 'round';
            context.miterLimit = 2;
            context.lineWidth = Math.max(0.5, Number(ol.width) || 0);
            context.strokeStyle = ol.color || '#000000';
            context.strokeText(line, 0, y);
            context.restore();
        }

        if (sh?.enabled) {
            context.shadowColor = sh.color || 'rgba(0,0,0,0.55)';
            context.shadowBlur = Math.max(0, Number(sh.blur) || 0);
            context.shadowOffsetX = Number(sh.offsetX) || 0;
            context.shadowOffsetY = Number(sh.offsetY) || 0;
        } else {
            context.shadowColor = 'transparent';
            context.shadowBlur = 0;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
        }

        context.fillText(line, 0, y);
    }

    context.restore();
};

export const renderImageUrlWithLayersToJpeg = async (payload: {
    url: string;
    width: number;
    height: number;
    layers: Array<{
        text: string;
        font: string;
        size: number;
        color: string;
        x: number;
        y: number;
        rotation: number;
        align: 'left' | 'center' | 'right';
        weight: number;
    }>;
}) => {
    const image = await loadImageFromUrl(payload.url);
    const canvas = document.createElement('canvas');
    canvas.width = payload.width;
    canvas.height = payload.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');

    context.fillStyle = '#0b1020';
    context.fillRect(0, 0, payload.width, payload.height);
    drawImageFit(context, image, payload.width, payload.height, 'cover');

    for (const layer of payload.layers || []) {
        drawTextLayerToContext({ context, width: payload.width, height: payload.height, layer });
    }

    const outBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to render image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.92
        );
    });

    return new File([outBlob], `generated-${Date.now()}.jpg`, { type: 'image/jpeg' });
};
