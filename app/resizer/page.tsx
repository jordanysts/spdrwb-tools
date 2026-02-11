"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import {
    ArrowLeft,
    Download,
    Upload,
    Maximize2,
    Image as ImageIcon,
    Lock,
    Unlock,
    ZoomIn,
    RotateCcw,
    Package,
    RefreshCw,
    Sparkles,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import JSZip from 'jszip';

type OutputFormat = "png" | "jpeg";

interface ImageData {
    file: File;
    url: string;
    width: number;
    height: number;
    size: number;
    filename: string;
}

interface ProcessedData {
    blob: Blob;
    url: string;
    width: number;
    height: number;
    size: number;
}

interface ProcessingFile {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'complete' | 'error';
    inputUrl?: string;
    outputUrl?: string;
    outputBlob?: Blob;
    error?: string;
    progress: number;
    width: number;
    height: number;
    inputSize: number;
    outputSize?: number;
}

const PRESET_SIZES = [
    { name: "Original", width: 0, height: 0 },
    { name: "4K (3840×2160)", width: 3840, height: 2160 },
    { name: "Full HD (1920×1080)", width: 1920, height: 1080 },
    { name: "HD (1280×720)", width: 1280, height: 720 },
    { name: "SD (640×480)", width: 640, height: 480 },
    { name: "Instagram (1080×1080)", width: 1080, height: 1080 },
    { name: "Custom", width: -1, height: -1 },
];

// Helper function to create cropped image
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    outputWidth: number,
    outputHeight: number,
    format: OutputFormat,
    quality: number
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("No 2d context");
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw the cropped portion scaled to output size
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputWidth,
        outputHeight
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas is empty"));
            },
            `image/${format}`,
            quality / 100
        );
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.src = url;
    });
}

export default function ImageResizerPage() {
    const [inputImage, setInputImage] = useState<ImageData | null>(null);
    const [processedImage, setProcessedImage] = useState<ProcessedData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const [selectedPreset, setSelectedPreset] = useState(0); // Original
    const [customWidth, setCustomWidth] = useState(1920);
    const [customHeight, setCustomHeight] = useState(1080);
    const [lockAspectRatio, setLockAspectRatio] = useState(true);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>("jpeg");
    const [quality, setQuality] = useState(90);

    // Crop state
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const [batchMode, setBatchMode] = useState(false);
    const [batchFiles, setBatchFiles] = useState<ProcessingFile[]>([]);
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);

    // Tab state: 'optimize' or 'resize'
    const [activeTab, setActiveTab] = useState<'optimize' | 'resize'>('optimize');

    // TinyPNG Optimization state
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedImage, setOptimizedImage] = useState<{
        dataUrl: string;
        inputSize: number;
        outputSize: number;
        compressionPercent: number;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine if we should show crop interface
    const showCropInterface = inputImage && selectedPreset > 0 && selectedPreset < PRESET_SIZES.length - 1;

    // Calculate aspect ratio for cropper
    const getCropAspect = (): number | undefined => {
        if (selectedPreset === 0 || selectedPreset === PRESET_SIZES.length - 1) return undefined;
        const preset = PRESET_SIZES[selectedPreset];
        return preset.width / preset.height;
    };

    // Auto-process when settings change
    useEffect(() => {
        if (inputImage && croppedAreaPixels) {
            const timeoutId = setTimeout(() => {
                processImageWithSettings();
            }, 300);

            return () => clearTimeout(timeoutId);
        } else if (inputImage && (selectedPreset === 0 || selectedPreset === PRESET_SIZES.length - 1)) {
            const timeoutId = setTimeout(() => {
                processImageWithSettings();
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [
        selectedPreset,
        customWidth,
        customHeight,
        outputFormat,
        quality,
        croppedAreaPixels,
        inputImage,
    ]);

    const loadImage = (file: File): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Auto-detect: 1 file = single mode, 2+ files = batch mode
        if (files.length > 1) {
            handleBatchUpload(e);
            return;
        }

        // Single file mode
        const file = files[0];
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file");
            return;
        }

        try {
            setError("");
            setBatchFiles([]); // Clear batch mode
            const img = await loadImage(file);

            const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, "");

            setInputImage({
                file,
                url: URL.createObjectURL(file),
                width: img.width,
                height: img.height,
                size: file.size,
                filename: filenameWithoutExt,
            });

            setCustomWidth(img.width);
            setCustomHeight(img.height);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } catch (err) {
            setError("Failed to load image");
        }
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                // Check if all files are images
                const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
                if (imageFiles.length > 0) {
                    const fakeEvent = {
                        target: { files: imageFiles },
                    } as any;
                    handleFileUpload(fakeEvent);
                }
            }
        },
        [handleFileUpload]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setInputImage(null); // Clear single mode
        setError("");

        const newBatchFiles: ProcessingFile[] = files.filter(f => f.type.startsWith("image/")).map(file => ({
            id: Math.random().toString(36).substring(7), file, status: 'pending' as const, progress: 0,
            width: 0, height: 0, inputSize: file.size, inputUrl: URL.createObjectURL(file),
        }));
        setBatchFiles(newBatchFiles); // Replace instead of append
    };

    const processBatch = async () => {
        setIsProcessingBatch(true);
        for (const batchFile of batchFiles) {
            if (batchFile.status !== 'pending') continue;
            setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'processing' as const, progress: 0 } : f));
            try {
                const img = await loadImage(batchFile.file);
                setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, progress: 30, width: img.width, height: img.height } : f));
                let targetWidth = img.width, targetHeight = img.height;
                if (selectedPreset === 0) { targetWidth = img.width; targetHeight = img.height; }
                else if (selectedPreset === PRESET_SIZES.length - 1) { targetWidth = customWidth; targetHeight = customHeight; }
                else { const preset = PRESET_SIZES[selectedPreset]; targetWidth = preset.width; targetHeight = preset.height; }
                setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, progress: 50 } : f));
                const canvas = document.createElement("canvas");
                canvas.width = targetWidth; canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("Could not get canvas context");
                ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, progress: 80 } : f));
                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Failed")), `image/${outputFormat}`, quality / 100);
                });
                const url = URL.createObjectURL(blob);
                setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? {
                    ...f, status: 'complete' as const, progress: 100, outputUrl: url, outputBlob: blob, outputSize: blob.size
                } : f));
            } catch (error: any) {
                setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? {
                    ...f, status: 'error' as const, error: error.message || 'Failed'
                } : f));
            }
        }
        setIsProcessingBatch(false);
    };

    const downloadBatchAsZip = async () => {
        const zip = new JSZip();
        for (const file of batchFiles) {
            if (file.status === 'complete' && file.outputBlob) {
                const fileName = file.file.name.replace(/\.[^/.]+$/, '');
                const extension = outputFormat === "jpeg" ? "jpg" : "png";
                zip.file(`${fileName}.${extension}`, file.outputBlob);
            }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'processed-images.zip';
        link.click();
    };

    const processImageWithSettings = async () => {
        if (!inputImage) return;

        setIsProcessing(true);
        setError("");

        try {
            let targetWidth = inputImage.width;
            let targetHeight = inputImage.height;

            if (selectedPreset === 0) {
                targetWidth = inputImage.width;
                targetHeight = inputImage.height;
            } else if (selectedPreset === PRESET_SIZES.length - 1) {
                targetWidth = customWidth;
                targetHeight = customHeight;
            } else {
                const preset = PRESET_SIZES[selectedPreset];
                targetWidth = preset.width;
                targetHeight = preset.height;
            }

            let blob: Blob;

            if (showCropInterface && croppedAreaPixels) {
                // Use crop
                blob = await getCroppedImg(
                    inputImage.url,
                    croppedAreaPixels,
                    targetWidth,
                    targetHeight,
                    outputFormat,
                    quality
                );
            } else {
                // No crop - simple resize
                const img = await loadImage(inputImage.file);
                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");

                if (!ctx) throw new Error("Could not get canvas context");

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        (b) => {
                            if (b) resolve(b);
                            else reject(new Error("Failed to create blob"));
                        },
                        `image/${outputFormat}`,
                        quality / 100
                    );
                });
            }

            setProcessedImage({
                blob,
                url: URL.createObjectURL(blob),
                width: targetWidth,
                height: targetHeight,
                size: blob.size,
            });
        } catch (err) {
            setError("Failed to process image");
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePresetChange = (index: number) => {
        setSelectedPreset(index);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleCustomDimensionChange = (dimension: "width" | "height", value: number) => {
        if (!inputImage) return;

        if (dimension === "width") {
            setCustomWidth(value);
            if (lockAspectRatio) {
                const aspectRatio = inputImage.height / inputImage.width;
                setCustomHeight(Math.round(value * aspectRatio));
            }
        } else {
            setCustomHeight(value);
            if (lockAspectRatio) {
                const aspectRatio = inputImage.width / inputImage.height;
                setCustomWidth(Math.round(value * aspectRatio));
            }
        }
    };

    const resetCrop = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleDownload = () => {
        if (!processedImage || !inputImage) return;

        const link = document.createElement("a");
        link.href = processedImage.url;
        const extension = outputFormat === "jpeg" ? "jpg" : "png";
        link.download = `${inputImage.filename}.${extension}`;
        link.click();
    };

    // TinyPNG Optimization
    const optimizeWithTinyPNG = async () => {
        if (!inputImage) return;

        setIsOptimizing(true);
        setError("");
        setOptimizedImage(null);

        try {
            const formData = new FormData();

            let fileToSend = inputImage.file;

            // Auto-convert WebP to PNG
            if (inputImage.file.type === 'image/webp') {
                try {
                    const img = await loadImage(inputImage.file);
                    const canvas = document.createElement("canvas");
                    canvas.width = inputImage.width;
                    canvas.height = inputImage.height;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const pngBlob = await new Promise<Blob | null>(resolve =>
                            canvas.toBlob(resolve, 'image/png')
                        );
                        if (pngBlob) {
                            // Update filename to reflect PNG
                            fileToSend = new File([pngBlob], inputImage.filename + ".png", {
                                type: "image/png"
                            });
                        }
                    }
                } catch (e) {
                    console.error("WebP conversion failed, sending original", e);
                }
            }

            formData.append('file', fileToSend);

            const response = await fetch('/api/tools/tinypng', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to optimize image');
            }

            setOptimizedImage({
                dataUrl: data.dataUrl,
                inputSize: data.input.size,
                outputSize: data.output.size,
                compressionPercent: data.compressionPercent,
            });
        } catch (err: any) {
            setError(err.message || 'Failed to optimize image');
            console.error('TinyPNG error:', err);
        } finally {
            setIsOptimizing(false);
        }
    };

    const downloadOptimized = () => {
        if (!optimizedImage || !inputImage) return;

        const link = document.createElement("a");
        link.href = optimizedImage.dataUrl;

        // Derive extension from the actual data URL mime type
        const match = optimizedImage.dataUrl.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType = match ? match[1] : (inputImage.file.type.includes('png') ? 'image/png' : 'image/jpeg');

        let extension = 'jpg';
        if (mimeType === 'image/png') extension = 'png';
        else if (mimeType === 'image/webp') extension = 'webp';

        link.download = `${inputImage.filename}-optimized.${extension}`;
        link.click();
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const getFileSizeChange = (): { percent: number; color: string } => {
        if (!inputImage || !processedImage) return { percent: 0, color: "text-gray-600" };

        const change = ((processedImage.size - inputImage.size) / inputImage.size) * 100;
        const color = change < 0 ? "text-green-400" : change > 0 ? "text-red-400" : "text-gray-600";

        return { percent: change, color };
    };

    const sizeChange = getFileSizeChange();

    const isBatchMode = batchFiles.length > 0;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Image Resizer</h1>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Upload & Controls */}
                    <div className="space-y-6">
                        {/* Upload/Crop Section */}
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">
                                        {showCropInterface ? "Crop Area" : "Input Image"}
                                    </span>
                                </div>
                                {showCropInterface && (
                                    <button
                                        onClick={resetCrop}
                                        className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors text-xs flex items-center gap-1"
                                        title="Reset crop"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Reset
                                    </button>
                                )}
                            </div>

                            {isBatchMode ? (
                                <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden h-[400px] flex flex-col">
                                    <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-gray-600" />
                                            <span className="text-sm text-gray-700">Batch Queue ({batchFiles.length})</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setBatchFiles([]);
                                                setInputImage(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                        {batchFiles.map(file => (
                                            <div key={file.id} className="bg-white rounded p-3 flex items-center justify-between group">
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm text-gray-800 truncate">{file.file.name}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${file.status === 'complete' ? 'bg-green-900/50 text-green-400' :
                                                            file.status === 'processing' ? 'bg-orange-900/50 text-gray-900' :
                                                                file.status === 'error' ? 'bg-red-900/50 text-red-400' :
                                                                    'bg-gray-50 text-gray-600'
                                                            }`}>
                                                            {file.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                                        <span>{formatFileSize(file.inputSize)}</span>
                                                        {file.outputSize && <span>→ {formatFileSize(file.outputSize)}</span>}
                                                    </div>
                                                    {file.status === 'processing' && (
                                                        <div className="w-full bg-gray-50 rounded-full h-1 mt-2">
                                                            <div className="bg-gray-800 h-1 rounded-full transition-all duration-300" style={{ width: `${file.progress}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                                {file.status === 'pending' && (
                                                    <button
                                                        onClick={() => setBatchFiles(prev => prev.filter(f => f.id !== file.id))}
                                                        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <label className="block p-4 border-2 border-dashed border-zinc-800 rounded-lg hover:border-gray-200 hover:bg-white/50 transition-colors cursor-pointer text-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleBatchUpload}
                                                className="hidden"
                                            />
                                            <span className="text-xs text-gray-500">+ Add more images</span>
                                        </label>
                                    </div>
                                </div>
                            ) : showCropInterface ? (
                                <div className="relative h-[400px] bg-gray-100">
                                    <Cropper
                                        image={inputImage!.url}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={getCropAspect()}
                                        onCropChange={setCrop}
                                        onCropComplete={onCropComplete}
                                        onZoomChange={setZoom}
                                    />
                                </div>
                            ) : (
                                <label
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className="block p-6 min-h-[280px] flex items-center justify-center cursor-pointer bg-white"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {inputImage ? (
                                        <img
                                            src={inputImage.url}
                                            alt="Input"
                                            className="max-h-[260px] max-w-full rounded object-contain"
                                        />
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-10 h-10 mx-auto text-gray-500 mb-4" />
                                            <p className="text-gray-700 mb-1">Drop Images Here</p>
                                            <p className="text-gray-500 text-sm mb-1">- or -</p>
                                            <p className="text-gray-700">Click to Upload</p>
                                            <p className="text-zinc-600 text-xs mt-2 text-opacity-70">(Upload multiple for batch mode)</p>
                                        </div>
                                    )}
                                </label>
                            )}

                            {inputImage && (
                                <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-600">
                                    {inputImage.width} × {inputImage.height} • {formatFileSize(inputImage.size)}
                                </div>
                            )}

                            {/* Zoom Control (only when cropping) */}
                            {showCropInterface && (
                                <div className="px-4 py-3 bg-white border-t border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <ZoomIn className="w-4 h-4 text-gray-600" />
                                        <input
                                            type="range"
                                            min="1"
                                            max="3"
                                            step="0.1"
                                            value={zoom}
                                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                                            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer slider"
                                            style={{
                                                background: `linear-gradient(to right, #f97316 0%, #f97316 ${((zoom - 1) / 2) * 100
                                                    }%, #e5e7eb ${((zoom - 1) / 2) * 100}%, #e5e7eb 100%)`,
                                            }}
                                        />
                                        <span className="text-xs text-gray-600 w-12 text-right">{zoom.toFixed(1)}x</span>
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* Controls */}
                        <div className="bg-gray-100/50 rounded-lg border border-gray-200 overflow-hidden">
                            {/* Tab Header */}
                            <div className="flex border-b border-gray-200">
                                <button
                                    onClick={() => setActiveTab('optimize')}
                                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'optimize'
                                        ? 'bg-orange-50 text-gray-900 border-b-2 border-orange-400'
                                        : 'text-gray-600 hover:text-gray-700 hover:bg-white'
                                        }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Optimize
                                </button>
                                <button
                                    onClick={() => setActiveTab('resize')}
                                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'resize'
                                        ? 'bg-orange-50 text-gray-900 border-b-2 border-orange-400'
                                        : 'text-gray-600 hover:text-gray-700 hover:bg-white'
                                        }`}
                                >
                                    <Maximize2 className="w-4 h-4" />
                                    Resize
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Optimize Tab Content */}
                                {activeTab === 'optimize' && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-4">
                                            Smart compression powered by TinyPNG. Keeps original size and format.
                                        </p>

                                        {inputImage ? (
                                            <>
                                                <button
                                                    onClick={optimizeWithTinyPNG}
                                                    disabled={isOptimizing}
                                                    className="w-full py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {isOptimizing ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Optimizing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Optimize Image
                                                        </>
                                                    )}
                                                </button>

                                                {optimizedImage && (
                                                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-gray-600">
                                                                {formatFileSize(optimizedImage.inputSize)} → {formatFileSize(optimizedImage.outputSize)}
                                                            </span>
                                                            <span className="text-sm text-gray-900 font-medium">
                                                                -{optimizedImage.compressionPercent}% saved
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="p-4 rounded-lg bg-white/50 border border-gray-200 text-center">
                                                <Upload className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                                                <p className="text-gray-500 text-sm">Upload an image to optimize</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Resize Tab Content */}
                                {activeTab === 'resize' && (
                                    <>
                                        <p className="text-xs text-gray-500 mb-4">
                                            Change image dimensions, format, and quality. Select a preset size to enable cropping.
                                        </p>

                                        {/* Size Presets */}
                                        <div>
                                            <label className="text-sm text-gray-700 mb-2 block">Resize Presets</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {PRESET_SIZES.map((preset, index) => (
                                                    <button
                                                        key={preset.name}
                                                        onClick={() => handlePresetChange(index)}
                                                        disabled={!inputImage}
                                                        className={`px-3 py-2 rounded text-sm transition-colors ${selectedPreset === index
                                                            ? "bg-gray-800 text-white"
                                                            : "bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            }`}
                                                    >
                                                        {preset.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Dimensions */}
                                        {selectedPreset === PRESET_SIZES.length - 1 && (
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm text-gray-700">Custom Size</label>
                                                    <button
                                                        onClick={() => setLockAspectRatio(!lockAspectRatio)}
                                                        disabled={!inputImage}
                                                        className="p-1.5 bg-white hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                                                        title={lockAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
                                                    >
                                                        {lockAspectRatio ? (
                                                            <Lock className="w-4 h-4 text-gray-900" />
                                                        ) : (
                                                            <Unlock className="w-4 h-4 text-gray-600" />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-gray-500 mb-1 block">Width</label>
                                                        <input
                                                            type="number"
                                                            value={customWidth}
                                                            onChange={(e) =>
                                                                handleCustomDimensionChange("width", parseInt(e.target.value) || 0)
                                                            }
                                                            disabled={!inputImage}
                                                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 disabled:opacity-50"
                                                            min="1"
                                                            max="10000"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs text-gray-500 mb-1 block">Height</label>
                                                        <input
                                                            type="number"
                                                            value={customHeight}
                                                            onChange={(e) =>
                                                                handleCustomDimensionChange("height", parseInt(e.target.value) || 0)
                                                            }
                                                            disabled={!inputImage}
                                                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 disabled:opacity-50"
                                                            min="1"
                                                            max="10000"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Output Format */}
                                        <div>
                                            <label className="text-sm text-gray-700 mb-2 block">Output Format</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setOutputFormat("jpeg")}
                                                    disabled={!inputImage}
                                                    className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${outputFormat === "jpeg"
                                                        ? "bg-gray-800 text-white"
                                                        : "bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                        }`}
                                                >
                                                    JPG
                                                </button>
                                                <button
                                                    onClick={() => setOutputFormat("png")}
                                                    disabled={!inputImage}
                                                    className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${outputFormat === "png"
                                                        ? "bg-gray-800 text-white"
                                                        : "bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                        }`}
                                                >
                                                    PNG
                                                </button>
                                            </div>
                                        </div>

                                        {/* Quality Slider (JPG only) */}
                                        {outputFormat === "jpeg" && (
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm text-gray-700">Quality</label>
                                                    <span className="text-sm text-gray-600">{quality}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="100"
                                                    value={quality}
                                                    onChange={(e) => setQuality(parseInt(e.target.value))}
                                                    disabled={!inputImage}
                                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                                                    style={{
                                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${quality}%, #e5e7eb ${quality}%, #e5e7eb 100%)`,
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {!inputImage && (
                                            <div className="p-4 rounded-lg bg-white/50 border border-gray-200 text-center">
                                                <Upload className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                                                <p className="text-gray-500 text-sm">Upload an image to resize</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Error Display */}
                                {error && (
                                    <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Output */}
                    <div className="space-y-6">
                        {/* Upload/Crop Section (Moved) */}

                        {isBatchMode ? (
                            <div className="space-y-6">
                                <div className="bg-gray-100 rounded-lg border border-gray-200 p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <RefreshCw className="w-5 h-5 text-gray-900" />
                                        <h3 className="font-medium text-gray-800">Batch Actions</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={processBatch}
                                            disabled={isProcessingBatch || batchFiles.every(f => f.status === 'complete')}
                                            className="w-full py-2.5 bg-gray-900 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isProcessingBatch ? (
                                                <>Processing {Math.round(batchFiles.reduce((acc, f) => acc + f.progress, 0) / batchFiles.length)}%...</>
                                            ) : (
                                                <>Start Processing</>
                                            )}
                                        </button>

                                        <button
                                            onClick={downloadBatchAsZip}
                                            disabled={!batchFiles.some(f => f.status === 'complete')}
                                            className="w-full py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download All (ZIP)
                                        </button>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-zinc-800">
                                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                                            <span>Completed</span>
                                            <span className="text-gray-900">{batchFiles.filter(f => f.status === 'complete').length} / {batchFiles.length}</span>
                                        </div>
                                        <div className="w-full bg-white rounded-full h-1.5">
                                            <div
                                                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                                style={{ width: `${(batchFiles.filter(f => f.status === 'complete').length / batchFiles.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Output Image - Only show in Resize mode */}
                                {activeTab === "resize" && (
                                    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                                        <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Maximize2 className="w-4 h-4 text-gray-600" />
                                                <span className="text-sm text-gray-700">Output Image</span>
                                                {isProcessing && (
                                                    <span className="text-xs text-gray-900 animate-pulse">Processing...</span>
                                                )}
                                            </div>
                                            {processedImage && (
                                                <button
                                                    onClick={handleDownload}
                                                    className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4 text-gray-700" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-6 min-h-[280px] flex items-center justify-center bg-white">
                                            {processedImage ? (
                                                <img
                                                    src={processedImage.url}
                                                    alt="Output"
                                                    className="max-h-[260px] max-w-full rounded object-contain"
                                                />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                                                    <p className="text-gray-500 text-sm">Output will appear here</p>
                                                </div>
                                            )}
                                        </div>
                                        {processedImage && (
                                            <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-600">
                                                {processedImage.width} × {processedImage.height} •{" "}
                                                {formatFileSize(processedImage.size)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* File Size Comparison - Only for Resize tab */}
                                {activeTab === 'resize' && inputImage && processedImage && (
                                    <div className="bg-gray-100/50 rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-sm font-medium text-gray-700 mb-4">File Size Comparison</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Before:</span>
                                                <span className="text-sm text-gray-900">{formatFileSize(inputImage.size)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">After:</span>
                                                <span className="text-sm text-gray-900">
                                                    {formatFileSize(processedImage.size)}
                                                </span>
                                            </div>
                                            <div className="h-px bg-gray-50 my-2" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Change:</span>
                                                <span className={`text-sm font-medium ${sizeChange.color}`}>
                                                    {sizeChange.percent > 0 ? "+" : ""}
                                                    {sizeChange.percent.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Optimized Result - Only for Optimize tab */}
                                {activeTab === 'optimize' && optimizedImage && (
                                    <div className="bg-gray-100/50 rounded-lg border border-orange-200 p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Sparkles className="w-5 h-5 text-gray-800" />
                                            <h3 className="text-sm font-medium text-gray-900">Optimization Complete</h3>
                                        </div>
                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Original:</span>
                                                <span className="text-sm text-gray-900">{formatFileSize(optimizedImage.inputSize)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Optimized:</span>
                                                <span className="text-sm text-gray-900">{formatFileSize(optimizedImage.outputSize)}</span>
                                            </div>
                                            <div className="h-px bg-gray-50 my-2" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Saved:</span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    -{optimizedImage.compressionPercent}%
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={downloadOptimized}
                                            className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Optimized
                                        </button>
                                    </div>
                                )}

                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Slider Styles */}
            <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          box-shadow: 0 0 0 2px #18181b, 0 0 0 4px rgba(249, 115, 22, 0.2);
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid #18181b;
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
        }
      `}</style>
        </div>
    );
}
