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
