'use client';

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Download, Loader2, Maximize, ImageIcon, Sliders } from "lucide-react";
import {
    ReactCompareSlider,
    ReactCompareSliderImage
} from "react-compare-slider";
import { upscaleImage } from "./actions";
import { compressImage } from "@/lib/image-compression";

export default function UpscalerPage() {
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [outputImage, setOutputImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [inputDims, setInputDims] = useState<{ width: number, height: number } | null>(null);
    const [outputDims, setOutputDims] = useState<{ width: number, height: number } | null>(null);

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

            if (data.output) {
                const outUrl = Array.isArray(data.output) ? data.output[0] : data.output;
                setOutputImage(outUrl);
                const img = new Image();
                img.onload = () => setOutputDims({ width: img.width, height: img.height });
                img.src = outUrl;
            } else {
                throw new Error("No output received");
            }
        } catch (err) {
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
                    <Link href="/tools" className="p-2 hover:bg-white rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-orange-600">Image Upscaler</h1>
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
                                <Sliders className="w-4 h-4 text-orange-600" />
                                <span className="font-medium text-gray-800">Settings</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-600">Scale Factor</label>
                                    <select
                                        value={scale}
                                        onChange={(e) => setScale(Number(e.target.value))}
                                        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
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
                                        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
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
                                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
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
                                        className={`w-11 h-6 rounded-full transition-colors relative ${faceEnhance ? "bg-orange-600" : "bg-gray-50"
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
                            className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                                    {outputDims && <span className="text-xs text-orange-600 ml-auto font-mono">{outputDims.width} x {outputDims.height}</span>}
                                </div>
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
                                    <div className="max-h-full max-w-full">
                                        <ReactCompareSlider
                                            itemOne={
                                                <ReactCompareSliderImage
                                                    src={inputImage}
                                                    alt="Before"
                                                    style={{ objectFit: "contain" }}
                                                />
                                            }
                                            itemTwo={
                                                <ReactCompareSliderImage
                                                    src={outputImage}
                                                    alt="After"
                                                    style={{ objectFit: "contain" }}
                                                />
                                            }
                                            style={{
                                                maxHeight: "100%",
                                                maxWidth: "100%",
                                                borderRadius: "0.5rem",
                                            }}
                                        />
                                    </div>
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
