'use client';

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Download, Loader2, Maximize, ImageIcon, Sliders } from "lucide-react";
import { upscaleImage } from "./actions";
import { compressImage } from "@/lib/image-compression";
import CompareSlider from "@/components/CompareSlider";

export default function UpscalerPage() {
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [outputImage, setOutputImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [inputDims, setInputDims] = useState<{ width: number, height: number } | null>(null);
    const [outputDims, setOutputDims] = useState<{ width: number, height: number } | null>(null);
    const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');

    // Parameters
    const [scale, setScale] = useState(2);
    const [modelName, setModelName] = useState("Standard V2");
    const [faceEnhance, setFaceEnhance] = useState(false);
    const [faceEnhanceStrength, setFaceEnhanceStrength] = useState(0.5);
    const [outputFormat, setOutputFormat] = useState("png");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file");
            return;
        }

        setError("");

        try {
            let dataUrl: string;

            // If file is larger than 3MB, compress it
            if (file.size > 3 * 1024 * 1024) {
                setError("Compressing large image...");
                dataUrl = await compressImage(file, 3 * 1024 * 1024, 0.85);
                setError(""); // Clear compression message
            } else {
                // File is small enough, read directly
                const reader = new FileReader();
                dataUrl = await new Promise<string>((resolve, reject) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            setInputImage(dataUrl);
            const img = new Image();
            img.onload = () => setInputDims({ width: img.width, height: img.height });
            img.src = dataUrl;

            setOutputImage(null);
            setOutputDims(null);
        } catch (err) {
            setError("Failed to process image. Please try a different file.");
        }
    };

    const handleUpscale = async () => {
        if (!inputImage || isProcessing) return;

        setIsProcessing(true);
        setError("");
        setOutputImage(null);

        try {
            const data = await upscaleImage({
                image: inputImage,
                scale,
                model_name: modelName,
                face_enhance: faceEnhance,
                face_enhance_strength: faceEnhanceStrength,
                output_format: outputFormat,
            });

            // Check for error response
            if (!data.success && data.error) {
                throw new Error(data.error);
            }

            if (data.output) {
                const outUrl = Array.isArray(data.output) ? data.output[0] : data.output;
                setOutputImage(outUrl);
                const img = new Image();
                img.onload = () => setOutputDims({ width: img.width, height: img.height });
                img.src = outUrl;
            } else {
                throw new Error("No output received");
            }
        } catch (err: any) {
            let errorMessage = err instanceof Error ? err.message : "Something went wrong";

            // Parse Replicate rate limit message
            if (errorMessage.includes("Request was throttled")) {
                const resetMatch = errorMessage.match(/resets in ~(\d+s)/);
                if (resetMatch) {
                    errorMessage = `Too many Requests, please try again in ~${resetMatch[1]}`;
                } else {
                    errorMessage = "Too many Requests, please try again shortly";
                }
            } else if (errorMessage.toLowerCase().includes("credit")) {
                errorMessage = "Insufficient credits";
            }

            setError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadImage = () => {
        if (!outputImage) return;
        const link = document.createElement("a");
        link.href = outputImage;
        link.download = `upscaled-${Date.now()}.${outputFormat}`;
        link.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Image Upscaler</h1>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Left Column - Input & Controls */}
                    <div className="space-y-6">
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-700">Input Image</span>
                                {inputDims && <span className="text-xs text-gray-500 ml-auto">{inputDims.width} x {inputDims.height}</span>}
                            </div>
                            <label
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="block p-6 min-h-[300px] flex items-center justify-center cursor-pointer bg-white hover:bg-zinc-50 transition-colors"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                {inputImage ? (
                                    <img
                                        src={inputImage}
                                        alt="Input"
                                        className="max-h-[280px] max-w-full rounded object-contain"
                                    />
                                ) : (
                                    <div className="text-center">
                                        <Upload className="w-10 h-10 mx-auto text-gray-500 mb-4" />
                                        <p className="text-gray-700 mb-1">Drop Image Here</p>
                                        <p className="text-gray-500 text-sm mb-1">- or -</p>
                                        <p className="text-gray-700">Click to Upload</p>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Controls */}
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden p-6 space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sliders className="w-4 h-4 text-gray-900" />
                                <span className="font-medium text-gray-800">Settings</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600">Scale Factor</label>
                                    <select
                                        value={scale}
                                        onChange={(e) => setScale(Number(e.target.value))}
                                        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800"
                                    >
                                        <option value={2}>2x</option>
                                        <option value={4}>4x</option>
                                        <option value={6}>6x</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600">Output Format</label>
                                    <select
                                        value={outputFormat}
                                        onChange={(e) => setOutputFormat(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800"
                                    >
                                        <option value="png">PNG</option>
                                        <option value="jpg">JPEG</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-600">AI Model</label>
                                <select
                                    value={modelName}
                                    onChange={(e) => setModelName(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800"
                                >
                                    <option value="Standard V2">Standard V2 (General Purpose)</option>
                                    <option value="Low Resolution V2">
                                        Low Resolution V2 (For blurry/noisy images)
                                    </option>
                                    <option value="High Fidelity V2">High Fidelity V2 (Preserves details)</option>
                                    <option value="CGI">CGI (For digital art)</option>
                                    <option value="Text Refine">Text Refine (Optimized for text)</option>
                                </select>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-700">Face Enhancement</label>
                                    <button
                                        onClick={() => setFaceEnhance(!faceEnhance)}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${faceEnhance ? "bg-gray-900" : "bg-gray-50"
                                            }`}
                                    >
                                        <div
                                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${faceEnhance ? "translate-x-5" : "translate-x-0"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {faceEnhance && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Enhancement Strength</span>
                                            <span className="text-gray-700">
                                                {Math.round(faceEnhanceStrength * 100)}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            value={faceEnhanceStrength}
                                            onChange={(e) => setFaceEnhanceStrength(parseFloat(e.target.value))}
                                            className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                                            style={{
                                                background: `linear-gradient(to right, #f97316 0%, #f97316 ${faceEnhanceStrength * 100
                                                    }%, #3f3f46 ${faceEnhanceStrength * 100}%, #3f3f46 100%)`,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleUpscale}
                            disabled={!inputImage || isProcessing}
                            className="w-full py-3 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Upscaling...
                                </>
                            ) : (
                                <>
                                    <Maximize className="w-4 h-4" />
                                    Upscale Image
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Column - Output with Comparison Slider */}
                    <div className="space-y-6">
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden h-full min-h-[600px]">
                            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Maximize className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">
                                        {outputImage ? "Before / After Comparison" : "Upscaled Result"}
                                    </span>
                                    {outputDims && <span className="text-xs text-gray-900 font-mono">{outputDims.width} x {outputDims.height}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {outputImage && (
                                        <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                            <button
                                                onClick={() => setViewMode('slider')}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                    viewMode === 'slider' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                Slider
                                            </button>
                                            <button
                                                onClick={() => setViewMode('side-by-side')}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                    viewMode === 'side-by-side' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                Side by Side
                                            </button>
                                        </div>
                                    )}
                                    {outputImage && (
                                        <button
                                            onClick={downloadImage}
                                            className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4 text-gray-700" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 h-[calc(100%-48px)] flex items-center justify-center bg-white">
                                {isProcessing ? (
                                    <div className="text-center flex flex-col items-center">
                                        <img
                                            src="/frog-rolling.gif"
                                            alt="Loading..."
                                            className="w-10 h-10 mb-4"
                                        />
                                        <p className="text-gray-600">Enhancing details...</p>
                                        <p className="text-gray-500 text-xs mt-2">This may take up to a minute</p>
                                    </div>
                                ) : outputImage && inputImage ? (
                                    viewMode === 'slider' ? (
                                        <CompareSlider
                                            beforeImage={inputImage}
                                            afterImage={outputImage}
                                            beforeLabel="Before"
                                            afterLabel="After"
                                            className="w-full h-full rounded-lg"
                                        />
                                    ) : (
                                        <div className="flex gap-4 h-full w-full">
                                            <div className="flex-1 min-w-0 bg-zinc-100 rounded-lg overflow-hidden relative">
                                                <span className="absolute top-2 left-2 bg-black/50 text-white px-2 py-0.5 text-xs rounded backdrop-blur-sm z-10">Before</span>
                                                <img src={inputImage} alt="Before" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex-1 min-w-0 bg-zinc-100 rounded-lg overflow-hidden relative">
                                                <span className="absolute top-2 left-2 bg-gray-800/80 text-white px-2 py-0.5 text-xs rounded backdrop-blur-sm z-10">After</span>
                                                <img src={outputImage} alt="After" className="w-full h-full object-contain" />
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center">
                                        <Maximize className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                                        <p className="text-gray-500 text-sm">Upscaled image will appear here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <style jsx>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
          .slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
        `}</style>
            </div>
        </div>
    );
}
