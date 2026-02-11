"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Download,
  Upload,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ArrowLeft as BackIcon, // Rename to avoid conflict if needed, or just use ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { generateExpression } from "./actions";
import { compressImage } from "@/lib/image-compression";

interface ExpressionParams {
  rotate_pitch: number;
  rotate_yaw: number;
  rotate_roll: number;
  blink: number;
  eyebrow: number;
  wink: number;
  pupil_x: number;
  pupil_y: number;
  aaa: number;
  eee: number;
  woo: number;
  smile: number;
  src_ratio: number;
  sample_ratio: number;
  crop_factor: number;
  output_format: string;
  output_quality: number;
}

const defaultParams: ExpressionParams = {
  rotate_pitch: 0,
  rotate_yaw: 0,
  rotate_roll: 0,
  blink: 0,
  eyebrow: 0,
  wink: 0,
  pupil_x: 0,
  pupil_y: 0,
  aaa: 0,
  eee: 0,
  woo: 0,
  smile: 0,
  src_ratio: 1,
  sample_ratio: 1,
  crop_factor: 1.5,
  output_format: "png",
  output_quality: 100,
};

type TabType = "HEAD" | "EYES" | "MOUTH" | "MORE";

// Composite adjustment parameters
interface CompositeParams {
  scale: number;      // Scale multiplier for the face size (1.0 = calculated, 1.1 = 10% larger)
  offsetX: number;    // Horizontal offset in percentage of image width
  offsetY: number;    // Vertical offset in percentage of image height
  blendRadius: number; // Blend feather radius (0.5 = 50% of face size)
  blendMode: 'normal' | 'difference'; // Blend mode for alignment
}

const defaultCompositeParams: CompositeParams = {
  scale: 0.90,
  offsetX: 0,
  offsetY: -1,
  blendRadius: 0.80,
  blendMode: 'normal',
};

// Helper to load image and get dimensions
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Canvas-based paste-back composite function
const compositeWithCanvas = async (
  originalImageSrc: string,
  editedFaceSrc: string,
  cropFactor: number,
  compositeParams: CompositeParams
): Promise<string> => {
  const originalImg = await loadImage(originalImageSrc);
  const editedFaceImg = await loadImage(editedFaceSrc);

  // The expression editor crops the face from the center of the image
  // crop_factor determines how much context is included (1.5 = tight, 2.5 = more context)

  // Estimate the face region in the original image
  const originalSize = Math.min(originalImg.width, originalImg.height);

  // Calculate what portion of the original this represents
  // The model outputs a square crop of the face region
  const capturedSize = (originalSize / cropFactor) * compositeParams.scale;

  // Calculate center position
  const centerX = originalImg.width / 2;
  const centerY = originalImg.height / 2;

  // Apply user offsets (as percentage of image dimensions)
  // Flip Y offset direction (positive = up)
  const offsetX = (compositeParams.offsetX / 100) * originalImg.width;
  const offsetY = -(compositeParams.offsetY / 100) * originalImg.height;

  const faceCenterX = centerX + offsetX;
  const faceCenterY = centerY + offsetY;

  // Target size and position for the edited face
  const targetSize = capturedSize;
  const targetX = faceCenterX - targetSize / 2;
  const targetY = faceCenterY - targetSize / 2;

  // Create square mask size based on blend radius
  // blendRadius now controls the size of the inner opaque square relative to the target size
  const maskSize = targetSize * compositeParams.blendRadius;

  // Create the final composite
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = originalImg.width;
  finalCanvas.height = originalImg.height;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("Could not get canvas context");

  // Handle Difference Mode (Alignment Helper)
  if (compositeParams.blendMode === 'difference') {
    // For alignment, we want to see the Edited Face diffed against the Original Image
    // So we draw Original, then draw Edited Face on top with 'difference' blend

    // Draw Original (Full)
    finalCtx.drawImage(originalImg, 0, 0);

    // Set Blend Mode
    finalCtx.globalCompositeOperation = 'difference';

    // Draw Edited Face (with opacity/mask? usually just raw to see pixels)
    // We might want to fade it out at edges? For now, let's draw raw to ensure clarity.
    finalCtx.drawImage(
      editedFaceImg,
      targetX,
      targetY,
      targetSize,
      targetSize
    );
  } else {
    // Normal Mode: Face Under Mask logic

    // Draw the edited face first (will be underneath)
    finalCtx.drawImage(
      editedFaceImg,
      targetX,
      targetY,
      targetSize,
      targetSize
    );

    // Create a temp canvas for the original with a hole cut out
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalImg.width;
    tempCanvas.height = originalImg.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("Could not get temp canvas context");

    // Draw original
    tempCtx.drawImage(originalImg, 0, 0);

    // Create radial gradient for feathered hole
    const gradient = tempCtx.createRadialGradient(
      faceCenterX,
      faceCenterY,
      targetSize / 2 * compositeParams.blendRadius * 0.8, // Inner radius (fully transparent)
      faceCenterX,
      faceCenterY,
      targetSize / 2 * compositeParams.blendRadius * 1.2  // Outer radius (fully opaque)
    );
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(0.5, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    // Cut out the face area with feathered edges
    tempCtx.globalCompositeOperation = "destination-out";
    tempCtx.fillStyle = gradient;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the original (with hole) on top of the edited face
    finalCtx.globalCompositeOperation = 'source-over'; // Reset to default
    finalCtx.drawImage(tempCanvas, 0, 0);
  }

  return finalCanvas.toDataURL("image/png");
};


export default function ExpressionEditorPage() {
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [error, setError] = useState("");
  const [params, setParams] = useState<ExpressionParams>(defaultParams);
  const [activeTab, setActiveTab] = useState<TabType>("HEAD");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compositeRef = useRef<HTMLDivElement>(null);

  // Composite state
  const [compositeImage, setCompositeImage] = useState<string | null>(null);
  const [isCompositing, setIsCompositing] = useState(false);
  const [compositeError, setCompositeError] = useState("");
  const [compositeParams, setCompositeParams] = useState<CompositeParams>(defaultCompositeParams);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'slider' | 'side-by-side'>('side-by-side');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setInputImage(dataUrl);
      setOutputImage(null);
      setCompositeImage(null);
    } catch (err) {
      setError("Failed to process image. Please try a different file.");
    }
  }, []);

  // Live update composite when params change
  useEffect(() => {
    if (outputImage && inputImage && compositeImage) {
      // Auto-update composite when sliders change
      const updateComposite = async () => {
        try {
          const result = await compositeWithCanvas(
            inputImage,
            outputImage,
            params.crop_factor,
            compositeParams
          );
          setCompositeImage(result);
        } catch (err) {
          console.error('Live composite update failed:', err);
        }
      };
      updateComposite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositeParams]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setInputImage(reader.result as string);
        setOutputImage(null);
        setCompositeImage(null);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Mouse drag handlers for composite positioning
  const handleCompositeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!compositeImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCompositeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    // Scale movement by a factor for finer control
    const sensitivity = 0.05;
    setCompositeParams(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx * sensitivity,
      offsetY: prev.offsetY - dy * sensitivity, // Inverted Y
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCompositeMouseUp = () => {
    setIsDragging(false);
  };

  const generateImage = async () => {
    if (!inputImage || isGenerating) return;

    setIsGenerating(true);
    setError("");
    setGenerateProgress(0);
    setCompositeImage(null);

    // Simulate progress while waiting for Replicate API
    const progressInterval = setInterval(() => {
      setGenerateProgress(prev => {
        if (prev >= 90) return prev;
        const increment = prev < 30 ? 6 : prev < 60 ? 4 : prev < 80 ? 2 : 1;
        return Math.min(prev + increment, 90);
      });
    }, 400);

    try {
      const data = await generateExpression({
        image: inputImage,
        ...params,
        rotate_pitch: params.rotate_pitch * -1, // Invert pitch so Left=Down, Right=Up
      });

      clearInterval(progressInterval);
      setGenerateProgress(95);

      // Check for error response
      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      if (data.output) {
        setGenerateProgress(100);
        setTimeout(() => {
          setOutputImage(Array.isArray(data.output) ? data.output[0] : data.output);
        }, 200);
      } else {
        throw new Error("No output received");
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      let errorMessage = err instanceof Error ? err.message : "Something went wrong";

      // Handle specific error cases
      if (errorMessage.includes("Request was throttled")) {
        const resetMatch = errorMessage.match(/resets in ~(\d+s)/);
        if (resetMatch) {
          errorMessage = `Too many Requests, please try again in ~${resetMatch[1]}`;
        } else {
          errorMessage = "Too many Requests, please try again shortly";
        }
      } else if (errorMessage.toLowerCase().includes("credit")) {
        errorMessage = "Insufficient credits";
      } else if (errorMessage.toLowerCase().includes("payload") || errorMessage.toLowerCase().includes("too large") || errorMessage.toLowerCase().includes("413")) {
        errorMessage = "Image too large. Please use a smaller image (max 3MB) or compress it.";
      }

      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setGenerateProgress(0);
    }
  };

  const handleComposite = async () => {
    if (!outputImage || !inputImage || isCompositing) return;

    setIsCompositing(true);
    setCompositeError("");

    try {
      const result = await compositeWithCanvas(
        inputImage,
        outputImage,
        params.crop_factor,
        compositeParams
      );
      setCompositeImage(result);
      // Auto-scroll to composite section
      setTimeout(() => {
        compositeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setCompositeError(err instanceof Error ? err.message : "Composite failed");
    } finally {
      setIsCompositing(false);
    }
  };

  const updateParam = (key: keyof ExpressionParams, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const resetParams = () => {
    setParams(defaultParams);
  };

  const downloadImage = () => {
    if (!outputImage) return;
    const link = document.createElement("a");
    link.href = outputImage;
    link.download = `expression-edited-${Date.now()}.${params.output_format}`;
    link.click();
  };

  const SliderControl = ({
    label,
    param,
    min,
    max,
    step = 1,
  }: {
    label: string;
    param: keyof ExpressionParams;
    min: number;
    max: number;
    step?: number;
  }) => (
    <div className="space-y-2 mb-4">
      <div className="flex justify-between items-center">
        <label className="text-sm text-gray-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={params[param] as number}
            onChange={(e) => updateParam(param, parseFloat(e.target.value) || 0)}
            className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-sm text-center text-gray-900"
            min={min}
            max={max}
            step={step}
          />
          <button
            onClick={() => updateParam(param, defaultParams[param])}
            className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-8">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={params[param] as number}
          onChange={(e) => updateParam(param, parseFloat(e.target.value))}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #f97316 0%, #f97316 ${((params[param] as number - min) / (max - min)) * 100}%, #3f3f46 ${((params[param] as number - min) / (max - min)) * 100}%, #3f3f46 100%)`
          }}
        />
        <span className="text-xs text-gray-500 w-8 text-right">{max}</span>
      </div>
    </div>
  );

  const tabs: { key: TabType; label: string }[] = [
    { key: "HEAD", label: "HEAD" },
    { key: "EYES", label: "EYES" },
    { key: "MOUTH", label: "MOUTH" },

  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Expression Editor</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6 ml-12">Upload a face image, adjust expressions using the sliders, then click Generate.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Input & Controls */}
          <div className="space-y-6">
            {/* Input Image */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Input image</span>
              </div>
              <label
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="block p-6 min-h-[280px] flex items-center justify-center cursor-pointer bg-white"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {inputImage ? (
                  <img src={inputImage} alt="Input" className="max-h-[260px] max-w-full rounded object-contain" />
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

            {/* Tabs and Sliders */}
            <div>
              {/* Tabs */}
              <div className="flex gap-1 border-b border-zinc-800 mb-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key
                      ? "text-gray-900 border-b-2 border-orange-400"
                      : "text-gray-600 hover:text-gray-800"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-gray-100/50 rounded-lg border border-zinc-800 p-6 mb-6">
                {activeTab === "HEAD" && (
                  <>
                    <SliderControl label="Rotate Down-Up" param="rotate_pitch" min={-20} max={20} />
                    <SliderControl label="Rotate Left-Right turn" param="rotate_yaw" min={-20} max={20} />
                    <SliderControl label="Rotate Left-Right tilt" param="rotate_roll" min={-20} max={20} />
                  </>
                )}

                {activeTab === "EYES" && (
                  <>
                    <SliderControl label="Blink" param="blink" min={-20} max={5} />
                    <SliderControl label="Eyebrow" param="eyebrow" min={-10} max={15} />
                    <SliderControl label="Wink" param="wink" min={0} max={25} />
                    <SliderControl label="Pupil X [Horizontal]" param="pupil_x" min={-15} max={15} />
                    <SliderControl label="Pupil Y [Vertical]" param="pupil_y" min={-15} max={15} />
                  </>
                )}

                {activeTab === "MOUTH" && (
                  <>
                    <SliderControl label="AAA (Open)" param="aaa" min={-30} max={120} />
                    <SliderControl label="EEE (Wide)" param="eee" min={-20} max={15} />
                    <SliderControl label="WOO (Pucker)" param="woo" min={-20} max={15} />
                    <SliderControl label="Smile" param="smile" min={-0.3} max={1.3} step={0.1} />
                  </>
                )}


              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm mb-6">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Output */}
          <div className="space-y-6">
            {/* Output Image */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Edited Face</span>
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
              <div className="p-6 min-h-[280px] flex items-center justify-center bg-white">
                {isGenerating ? (
                  <div className="w-full max-w-xs flex flex-col items-center">
                    <img src="/frog-rolling.gif" alt="Loading..." className="w-10 h-10 mb-4" />
                    <div className="flex justify-between text-xs text-gray-600 mb-2 w-full">
                      <span>Generating expression...</span>
                      <span>{generateProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-50 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className="bg-gray-800 h-full transition-all duration-300 ease-out"
                        style={{ width: `${generateProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      {generateProgress < 25 && "Uploading image..."}
                      {generateProgress >= 25 && generateProgress < 50 && "Processing face..."}
                      {generateProgress >= 50 && generateProgress < 75 && "Applying expression changes..."}
                      {generateProgress >= 75 && generateProgress < 95 && "Rendering output..."}
                      {generateProgress >= 95 && "Finalizing..."}
                    </p>
                  </div>
                ) : outputImage ? (
                  <img src={outputImage} alt="Output" className="max-h-[260px] max-w-full rounded object-contain" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                    <p className="text-gray-500 text-sm">Output will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-4 pb-4 flex gap-4">
              <button
                onClick={resetParams}
                className="flex-1 py-3 bg-white hover:bg-gray-50 rounded-lg font-medium transition-colors text-gray-700"
              >
                Reset
              </button>
              <button
                onClick={generateImage}
                disabled={!inputImage || isGenerating}
                className="flex-1 py-3 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>

            {/* Paste Face Button - Under Output */}
            {outputImage && (
              <div className="px-4 pb-4">
                <button
                  onClick={handleComposite}
                  disabled={!outputImage || !inputImage || isCompositing}
                  className="w-full py-2.5 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {isCompositing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Compositing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Paste Face onto Original
                    </>
                  )}
                </button>
                {compositeError && (
                  <p className="text-red-400 text-xs mt-2">{compositeError}</p>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Full Width Composite Result - Moved Inside Container */}
        {compositeImage && (
          <div ref={compositeRef} className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden mt-6 scroll-mt-6">
            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-900" />
                <span className="text-sm text-gray-700">Final Composite</span>
              </div>
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = compositeImage;
                  link.download = `composite-${Date.now()}.png`;
                  link.click();
                }}
                className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row h-[600px]">
              {/* Left Side - Controls (1/3) */}
              <div className="w-full lg:w-1/3 p-6 border-r border-zinc-800 bg-gray-100/50 overflow-y-auto">
                <p className="text-sm text-gray-600 font-medium mb-6">Fine-tune alignment</p>

                <div className="space-y-6">
                  <p className="text-xs text-gray-500">Drag image or adjust sliders to align the face</p>

                  {/* Blend Mode Toggle */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-600">Blend Mode</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCompositeParams(p => ({ ...p, blendMode: 'normal' }))}
                          className={`px-3 py-1 rounded text-xs transition-colors ${compositeParams.blendMode === 'normal'
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => setCompositeParams(p => ({ ...p, blendMode: 'difference' }))}
                          className={`px-3 py-1 rounded text-xs transition-colors ${compositeParams.blendMode === 'difference'
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          title="Dark = aligned, bright = misaligned"
                        >
                          Difference
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-600">Scale</span>
                      <input
                        type="number"
                        min={0.1}
                        max={2.0}
                        step={0.01}
                        value={compositeParams.scale}
                        onChange={(e) => setCompositeParams(p => ({ ...p, scale: parseFloat(e.target.value) }))}
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-0.5 text-right text-sm text-gray-700 focus:outline-none focus:border-gray-800"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={2.0}
                      step={0.01}
                      value={compositeParams.scale}
                      onChange={(e) => setCompositeParams(p => ({ ...p, scale: parseFloat(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((compositeParams.scale - 0.1) / 1.9) * 100}%, #3f3f46 ${((compositeParams.scale - 0.1) / 1.9) * 100}%, #3f3f46 100%)`
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-600">X Offset [Horizontal]</span>
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        step={1}
                        value={compositeParams.offsetX}
                        onChange={(e) => setCompositeParams(p => ({ ...p, offsetX: parseFloat(e.target.value) }))}
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-0.5 text-right text-sm text-gray-700 focus:outline-none focus:border-gray-800"
                      />
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={1}
                      value={compositeParams.offsetX}
                      onChange={(e) => setCompositeParams(p => ({ ...p, offsetX: parseFloat(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((compositeParams.offsetX + 50) / 100) * 100}%, #3f3f46 ${((compositeParams.offsetX + 50) / 100) * 100}%, #3f3f46 100%)`
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-600">Y Offset [Vertical]</span>
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        step={1}
                        value={compositeParams.offsetY}
                        onChange={(e) => setCompositeParams(p => ({ ...p, offsetY: parseFloat(e.target.value) }))}
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-0.5 text-right text-sm text-gray-700 focus:outline-none focus:border-gray-800"
                      />
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={1}
                      value={compositeParams.offsetY}
                      onChange={(e) => setCompositeParams(p => ({ ...p, offsetY: parseFloat(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((compositeParams.offsetY + 50) / 100) * 100}%, #3f3f46 ${((compositeParams.offsetY + 50) / 100) * 100}%, #3f3f46 100%)`
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-600">Blend Radius</span>
                      <input
                        type="number"
                        min={0.3}
                        max={1.0}
                        step={0.01}
                        value={compositeParams.blendRadius}
                        onChange={(e) => setCompositeParams(p => ({ ...p, blendRadius: parseFloat(e.target.value) }))}
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-0.5 text-right text-sm text-gray-700 focus:outline-none focus:border-gray-800"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={1.0}
                      step={0.01}
                      value={compositeParams.blendRadius}
                      onChange={(e) => setCompositeParams(p => ({ ...p, blendRadius: parseFloat(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((compositeParams.blendRadius - 0.3) / 0.7) * 100}%, #3f3f46 ${((compositeParams.blendRadius - 0.3) / 0.7) * 100}%, #3f3f46 100%)`
                      }}
                    />
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-800 space-y-3">
                    <button
                      onClick={() => setIsComparing(!isComparing)}
                      className={`w-full py-2 rounded text-sm transition-colors flex items-center justify-center gap-2 ${isComparing
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                    >
                      <Layers className="w-4 h-4" />
                      {isComparing ? 'Exit Comparison' : 'Compare Original vs Result'}
                    </button>

                    <button
                      onClick={() => setCompositeParams({ scale: 1, offsetX: 0, offsetY: 0, blendRadius: 0.8, blendMode: 'normal' })}
                      className="w-full py-2 bg-white hover:bg-gray-50 rounded text-sm text-gray-700 transition-colors"
                    >
                      Reset Adjustments
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side - Image Preview (2/3) */}
              {/* Right Side - Image Preview (2/3) */}
              <div
                className="w-full lg:w-2/3 bg-white flex items-center justify-center p-4 relative"
                onMouseDown={!isComparing ? handleCompositeMouseDown : undefined}
                onMouseMove={!isComparing ? handleCompositeMouseMove : undefined}
                onMouseUp={!isComparing ? handleCompositeMouseUp : undefined}
                onMouseLeave={!isComparing ? handleCompositeMouseUp : undefined}
                style={{ cursor: !isComparing ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              >

                {isComparing && inputImage ? (
                    <div className="flex gap-2 h-full w-full">
                      <div className="flex-1 min-w-0 bg-zinc-100 rounded-lg overflow-hidden relative">
                        <span className="absolute top-2 left-2 bg-black/70 text-white px-2 py-0.5 text-[10px] rounded backdrop-blur-sm z-10">Original</span>
                        <img src={inputImage} alt="Original" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0 bg-zinc-100 rounded-lg overflow-hidden relative">
                        <span className="absolute top-2 left-2 bg-gray-800/80 text-white px-2 py-0.5 text-[10px] rounded backdrop-blur-sm z-10">Result</span>
                        <img src={compositeImage} alt="Result" className="w-full h-full object-contain" />
                      </div>
                    </div>
                ) : (
                  <img src={compositeImage} alt="Composite" className="max-h-full max-w-full object-contain" draggable={false} />
                )}

                {/* Comparison Toggle Overlay */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                  {isComparing && (
                    <>
                      <div className="flex bg-gray-100/80 backdrop-blur-sm rounded-lg p-1 border border-gray-200">
                        <button
                          onClick={() => setComparisonMode('slider')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${comparisonMode === 'slider' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                          Slider
                        </button>
                        <button
                          onClick={() => setComparisonMode('side-by-side')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${comparisonMode === 'side-by-side' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                          Side-by-Side
                        </button>
                      </div>
                      <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">
                        Comparing Original vs Result
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Slider Styles */}
        <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
      </div>
    </div>
  );
}
