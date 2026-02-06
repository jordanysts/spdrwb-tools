"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Download, Sparkles, Image as ImageIcon, Loader2, Upload, X, Wand2, RotateCcw, ZoomIn, ZoomOut, Square, RectangleHorizontal, RectangleVertical, User, UserCircle, Maximize, GitBranch, RefreshCw } from "lucide-react";
import Link from "next/link";

interface HistoryItem {
  id: string;
  base64: string;
  mimeType: string;
  prompt: string;
  parentId: string | null;
  timestamp: Date;
  isOriginal: boolean;
}

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentActiveId, setCurrentActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize processing canvas
  useEffect(() => {
    processingCanvasRef.current = document.createElement("canvas");
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("Image too large (Max 20MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const base64 = parts[1];

      // Reset history for new session
      setHistory([]);
      addToHistory(base64, mimeType, "Original Image", true, null);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const addToHistory = (base64: string, mimeType: string, promptText: string, isOriginal: boolean, parentId: string | null) => {
    const id = Date.now().toString();
    const item: HistoryItem = {
      id,
      base64,
      mimeType,
      prompt: promptText,
      parentId,
      timestamp: new Date(),
      isOriginal,
    };

    setHistory(prev => [...prev, item]);
    setCurrentActiveId(id);

    // Scroll to bottom after adding
    setTimeout(() => {
      feedContainerRef.current?.scrollTo({
        top: feedContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  const applyTransform = async (type: "ratio" | "zoom" | "framing", value: number | string) => {
    if (!currentActiveId) {
      setError("Upload an image first");
      return;
    }

    const activeItem = history.find(h => h.id === currentActiveId);
    if (!activeItem || !processingCanvasRef.current) return;

    const img = new Image();
    img.src = `data:${activeItem.mimeType};base64,${activeItem.base64}`;
    await new Promise<void>(resolve => { img.onload = () => resolve(); });

    const canvas = processingCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let newW = img.width;
    let newH = img.height;
    let generationPrompt = "";

    if (type === "ratio") {
      const ratioValue = value as number;
      const currentRatio = img.width / img.height;
      if (ratioValue > currentRatio) {
        newH = img.height;
        newW = img.height * ratioValue;
      } else {
        newW = img.width;
        newH = img.width / ratioValue;
      }
      const ratioLabel = ratioValue < 1 ? "portrait" : ratioValue > 1 ? "landscape" : "square";
      generationPrompt = `The input image represents a ${ratioLabel} frame. The central subject is sharp and MUST NOT be cropped, zoomed, or altered. The surrounding blurred area is placeholder context. Your task is to Outpaint: generate high-quality background scenery to replace the blurred areas, seamlessly extending the scene while keeping the central subject exactly as is.`;
    } else if (type === "zoom" || type === "framing") {
      let scale = 1;
      if (type === "framing") {
        scale = value === "headshot" ? 1.6 : value === "chest" ? 0.8 : value === "waist" ? 0.6 : 0.4;
      } else {
        scale = value as number;
      }

      if (scale > 1) {
        // Zoom in - crop center
        const sW = img.width / scale;
        const sH = img.height / scale;
        const sX = (img.width - sW) / 2;
        const sY = (img.height - sH) / 2;

        canvas.width = newW;
        canvas.height = newH;
        ctx.drawImage(img, sX, sY, sW, sH, 0, 0, newW, newH);

        generationPrompt = type === "framing" ? "Close up headshot. High detail face." : "Zoomed in. Enhance details and sharpness.";

        const newBase64 = canvas.toDataURL(activeItem.mimeType).split(",")[1];
        executeGeneration(newBase64, activeItem.mimeType, generationPrompt);
        return;
      } else {
        generationPrompt = "Zoom out. The central area is the original image. Generate realistic, high-detail background scenery to fill the surrounding empty space, seamlessly blending with the center.";
        if (type === "framing") {
          if (value === "chest") generationPrompt = "Expand view to chest-up portrait. Generate realistic upper body and shoulders. Seamlessly blend with face.";
          else if (value === "waist") generationPrompt = "Expand view to waist-up portrait. Generate realistic torso and arms. Seamlessly extend body.";
          else if (value === "full") generationPrompt = "Expand view to full body shot. Generate legs and feet standing. Seamlessly extend body to match head.";
        }
      }
    }

    // Cap max size
    const maxCap = 1500;
    if (newW > maxCap || newH > maxCap) {
      const downscale = Math.min(maxCap / newW, maxCap / newH);
      newW *= downscale;
      newH *= downscale;
    }

    canvas.width = newW;
    canvas.height = newH;

    // Background: Deep Blur Fill for context
    ctx.filter = "blur(50px)";
    ctx.drawImage(img, -newW * 0.1, -newH * 0.1, newW * 1.2, newH * 1.2);
    ctx.filter = "none";

    // Overlay to hint to AI that this is background
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, newW, newH);

    // Calculate position for centered sharp image
    let dW: number, dH: number, x: number, y: number;

    if (type === "ratio") {
      const scale = Math.min(newW / img.width, newH / img.height);
      dW = img.width * scale;
      dH = img.height * scale;
      x = (newW - dW) / 2;
      y = (newH - dH) / 2;
    } else {
      const scale = type === "framing"
        ? (value === "headshot" ? 1.6 : value === "chest" ? 0.8 : value === "waist" ? 0.6 : 0.4)
        : (value as number);

      dW = img.width * scale;
      dH = img.height * scale;
      x = (newW - dW) / 2;
      y = (newH - dH) / 2;
    }

    // Draw sharp center image with shadow
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.drawImage(img, x, y, dW, dH);
    ctx.shadowBlur = 0;

    const newBase64 = canvas.toDataURL(activeItem.mimeType).split(",")[1];
    executeGeneration(newBase64, activeItem.mimeType, generationPrompt);
  };

  const executeGeneration = async (base64Input: string, mimeType: string, generationPrompt: string) => {
    setIsGenerating(true);
    setError("");
    const parentIdOfNewGen = currentActiveId;

    const finalPrompt = "Maintain exact facial identity, lighting, and style. " + generationPrompt;

    try {
      const response = await fetch("/api/tools/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          inputImage: { data: base64Input, mimeType },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      if (data.image) {
        addToHistory(data.image.data, data.image.mimeType, generationPrompt, false, parentIdOfNewGen);
        setPrompt("");
      } else {
        throw new Error("No image generated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt");
      return;
    }
    if (!currentActiveId) {
      setError("Upload an image first");
      return;
    }

    const activeItem = history.find(h => h.id === currentActiveId);
    if (!activeItem) return;

    await executeGeneration(activeItem.base64, activeItem.mimeType, prompt);
  };

  const setPromptAndGenerate = (text: string) => {
    setPrompt(text);
    if (!currentActiveId) {
      setError("Upload an image first");
      return;
    }
    const activeItem = history.find(h => h.id === currentActiveId);
    if (activeItem) {
      executeGeneration(activeItem.base64, activeItem.mimeType, text);
    }
  };

  const resumeFrom = (id: string) => {
    setCurrentActiveId(id);
    setError("");
  };

  const downloadItem = (id: string) => {
    const item = history.find(h => h.id === id);
    if (!item) return;
    const link = document.createElement("a");
    link.href = `data:${item.mimeType};base64,${item.base64}`;
    link.download = `edit-v${history.indexOf(item) + 1}.png`;
    link.click();
  };

  const retryGeneration = (failedId: string) => {
    const failedItem = history.find(h => h.id === failedId);
    if (!failedItem || !failedItem.parentId) {
      setError("Cannot retry original image");
      return;
    }
    setCurrentActiveId(failedItem.parentId);
    setPrompt(failedItem.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateImage();
    }
  };

  const currentItem = history.find(h => h.id === currentActiveId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex">
      {/* Sidebar Controls */}
      <div className="w-[400px] bg-gray-100 border-r border-gray-200 flex flex-col h-screen shrink-0">
        <div className="p-5 border-b border-gray-200 bg-gray-100">
          <div className="flex items-center gap-3">
            <Link href="/tools" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600" /> Iterative Edit
              </h1>

            </div>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 bg-white border border-gray-200 hover:border-zinc-500 hover:bg-zinc-750 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2 group text-sm"
          >
            <Upload className="w-4 h-4 text-gray-600 group-hover:text-white" />
            <span>{history.length > 0 ? "Upload New Image" : "Upload Image to Start Session"}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileUpload} className="hidden" />

          <hr className="border-gray-200" />

          {/* Custom Prompt */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold uppercase tracking-wider">Custom Prompt</div>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none transition pr-12"
                placeholder="Type edits here..."
              />
              <button
                onClick={generateImage}
                disabled={!prompt.trim() || isGenerating || !currentActiveId}
                className="absolute right-2 bottom-2 p-2 bg-orange-600 hover:bg-orange-500 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Aspect Ratio & Zoom */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-600 font-semibold">Aspect Ratio</div>
              <div className="flex gap-1">
                <button onClick={() => applyTransform("ratio", 9 / 16)} disabled={isGenerating || !currentActiveId} className="flex-1 text-[10px] bg-white px-1 py-2 rounded hover:bg-gray-50 border border-gray-200 transition flex flex-col items-center gap-1 disabled:opacity-50">
                  <RectangleVertical className="w-3 h-3" /> 9:16
                </button>
                <button onClick={() => applyTransform("ratio", 1)} disabled={isGenerating || !currentActiveId} className="flex-1 text-[10px] bg-white px-1 py-2 rounded hover:bg-gray-50 border border-gray-200 transition flex flex-col items-center gap-1 disabled:opacity-50">
                  <Square className="w-3 h-3" /> 1:1
                </button>
                <button onClick={() => applyTransform("ratio", 16 / 9)} disabled={isGenerating || !currentActiveId} className="flex-1 text-[10px] bg-white px-1 py-2 rounded hover:bg-gray-50 border border-gray-200 transition flex flex-col items-center gap-1 disabled:opacity-50">
                  <RectangleHorizontal className="w-3 h-3" /> 16:9
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-600 font-semibold">Zoom</div>
              <div className="flex gap-2">
                <button onClick={() => applyTransform("zoom", 0.7)} disabled={isGenerating || !currentActiveId} className="flex-1 text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <ZoomOut className="w-3 h-3" /> Out
                </button>
                <button onClick={() => applyTransform("zoom", 1.3)} disabled={isGenerating || !currentActiveId} className="flex-1 text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <ZoomIn className="w-3 h-3" /> In
                </button>
              </div>
            </div>
          </div>

          {/* Framing */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold">Framing</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => applyTransform("framing", "headshot")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-2 rounded hover:bg-gray-50 border border-gray-200 text-left transition disabled:opacity-50">
                <UserCircle className="w-3 h-3 inline mr-2" />Headshot
              </button>
              <button onClick={() => applyTransform("framing", "chest")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-2 rounded hover:bg-gray-50 border border-gray-200 text-left transition disabled:opacity-50">
                <User className="w-3 h-3 inline mr-2" />Chest Up
              </button>
              <button onClick={() => applyTransform("framing", "waist")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-2 rounded hover:bg-gray-50 border border-gray-200 text-left transition disabled:opacity-50">
                <User className="w-3 h-3 inline mr-2" />Waist Up
              </button>
              <button onClick={() => applyTransform("framing", "full")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-2 rounded hover:bg-gray-50 border border-gray-200 text-left transition disabled:opacity-50">
                <Maximize className="w-3 h-3 inline mr-2" />Full Body
              </button>
            </div>
          </div>

          {/* Camera Angle Grid */}
          <div className="bg-white/50 p-3 rounded-xl border border-gray-200/50">
            <div className="text-xs text-gray-600 mb-2 font-semibold text-center">Camera Angle</div>
            <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
              <button onClick={() => setPromptAndGenerate("High angle shot from the left side, looking down at subject")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="High Left">
                <span className="rotate-[-45deg]">📹</span><span className="mt-1">HIGH L</span>
              </button>
              <button onClick={() => setPromptAndGenerate("High angle shot from directly above, looking down")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="High Center">
                <span>📹</span><span className="mt-1">HIGH</span>
              </button>
              <button onClick={() => setPromptAndGenerate("High angle shot from the right side, looking down at subject")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="High Right">
                <span className="rotate-[45deg]">📹</span><span className="mt-1">HIGH R</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Eye-level shot from the left profile")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Level Left">
                <span className="rotate-[-90deg]">📹</span><span className="mt-1">SIDE L</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Eye-level shot, straight on")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Level Center">
                <span>📹</span><span className="mt-1">LEVEL</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Eye-level shot from the right profile")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Level Right">
                <span className="rotate-[90deg]">📹</span><span className="mt-1">SIDE R</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Low angle shot from the left, looking up at subject")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Low Left">
                <span className="rotate-[-135deg]">📹</span><span className="mt-1">LOW L</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Low angle shot, looking up from below")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Low Center">
                <span className="rotate-[180deg]">📹</span><span className="mt-1">LOW</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Low angle shot from the right, looking up at subject")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50" title="Low Right">
                <span className="rotate-[135deg]">📹</span><span className="mt-1">LOW R</span>
              </button>
            </div>
          </div>

          {/* Lighting Environment */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold">Lighting Environment</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPromptAndGenerate("Relight scene with bright daytime natural sunlight. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>☀️</span> Daytime
              </button>
              <button onClick={() => setPromptAndGenerate("Relight scene with warm Golden Hour sunset lighting. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>🌅</span> Golden Hour
              </button>
              <button onClick={() => setPromptAndGenerate("Relight scene with soft, even Studio lighting. High quality portrait lighting. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>💡</span> Studio
              </button>
              <button onClick={() => setPromptAndGenerate("Relight scene to Nighttime. Dark ambient lighting with cinematic shadows. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>🌙</span> Night
              </button>
              <button onClick={() => setPromptAndGenerate("Relight scene with dramatic Cinematic lighting. High contrast and mood. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>🎬</span> Cinematic
              </button>
              <button onClick={() => setPromptAndGenerate("Relight scene with colorful Neon lighting. Cyberpunk aesthetic with pink and blue rim lights. Maintain facial identity.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition flex flex-col items-center gap-1 disabled:opacity-50">
                <span style={{ filter: 'brightness(0.7)' }}>⚡</span> Neon
              </button>
            </div>
          </div>

          {/* Selfie Pose */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold">Selfie Pose</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPromptAndGenerate("Selfie angle, Left arm extended forward towards the camera as if holding it. The hand and device are NOT visible (out of frame). High angle shot.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition disabled:opacity-50">
                👆 Left
              </button>
              <button onClick={() => setPromptAndGenerate("Selfie angle, Both arms extended forward towards the camera as if holding it. Hands and device are NOT visible (out of frame). High angle shot.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition disabled:opacity-50">
                Both
              </button>
              <button onClick={() => setPromptAndGenerate("Selfie angle, Right arm extended forward towards the camera as if holding it. The hand and device are NOT visible (out of frame). High angle shot.")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-2 py-2 rounded hover:bg-gray-50 border border-gray-200 text-center transition disabled:opacity-50">
                Right 👆
              </button>
            </div>
          </div>

          {/* Smile Strength */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="text-xs text-gray-600 font-semibold">Smile Strength</div>
              <div className="text-[10px] text-zinc-500">Frown ↔ Smile</div>
            </div>
            <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200">
              <button onClick={() => setPromptAndGenerate("Make expression very angry and frowning")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Angry/Frown">🤬</button>
              <button onClick={() => setPromptAndGenerate("Make expression slightly frowning")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Slight Frown">☹️</button>
              <button onClick={() => setPromptAndGenerate("Make expression neutral mouth")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Neutral">😐</button>
              <button onClick={() => setPromptAndGenerate("Make expression smiling slightly")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Slight Smile">🙂</button>
              <button onClick={() => setPromptAndGenerate("Make expression smiling broadly with teeth")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Big Smile">😁</button>
            </div>
          </div>

          {/* Eye Openness */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="text-xs text-gray-600 font-semibold">Eye Openness</div>
              <div className="text-[10px] text-zinc-500">Closed ↔ Wide</div>
            </div>
            <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200">
              <button onClick={() => setPromptAndGenerate("Close eyes completely")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Closed">😑</button>
              <button onClick={() => setPromptAndGenerate("Make eyes squinting")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Squint">_‿_</button>
              <button onClick={() => setPromptAndGenerate("Make eyes relaxed normal openness")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Normal">◉</button>
              <button onClick={() => setPromptAndGenerate("Open eyes wide")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Wide">😳</button>
              <button onClick={() => setPromptAndGenerate("Make eyes very wide open surprised")} disabled={isGenerating || !currentActiveId} className="flex-1 py-2 rounded text-sm hover:bg-gray-50 transition disabled:opacity-50" title="Very Wide">⊙▃⊙</button>
            </div>
          </div>

          {/* Head Orientation Grid */}
          <div className="bg-white/50 p-3 rounded-xl border border-gray-200/50">
            <div className="text-xs text-gray-600 mb-2 font-semibold text-center">Head Orientation</div>
            <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
              <button onClick={() => setPromptAndGenerate("Turn head up and to the left")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>↖️</span><span className="mt-1">UP L</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Tilt head up")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>⬆️</span><span className="mt-1">UP</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Turn head up and to the right")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>↗️</span><span className="mt-1">UP R</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Turn head left")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>⬅️</span><span className="mt-1">LEFT</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Look straight ahead")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>⊕</span><span className="mt-1">FRONT</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Turn head right")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>➡️</span><span className="mt-1">RIGHT</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Turn head down and to the left")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>↙️</span><span className="mt-1">DOWN L</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Tilt head down")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>⬇️</span><span className="mt-1">DOWN</span>
              </button>
              <button onClick={() => setPromptAndGenerate("Turn head down and to the right")} disabled={isGenerating || !currentActiveId} className="aspect-square flex flex-col items-center justify-center text-[10px] bg-white rounded hover:bg-gray-50 border border-gray-200 transition disabled:opacity-50">
                <span>↘️</span><span className="mt-1">DOWN R</span>
              </button>
            </div>
          </div>

          {/* Lens Studio Expressions */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold">Lens Studio Expressions (Exaggerated)</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPromptAndGenerate("Neutral expression")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Neutral</button>
              <button onClick={() => setPromptAndGenerate("Exaggeratedly raise eyebrows high")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Eyebrows Raised</button>
              <button onClick={() => setPromptAndGenerate("Exaggerated wide smile with teeth")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Smiling</button>
              <button onClick={() => setPromptAndGenerate("Exaggeratedly open mouth very wide")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Open Mouth</button>
              <button onClick={() => setPromptAndGenerate("Exaggerated extreme kiss face")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Kiss Face</button>
              <button onClick={() => setPromptAndGenerate("Exaggerated head tilt to the left")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Tilt Left</button>
              <button onClick={() => setPromptAndGenerate("Exaggerated head tilt to the right")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Tilt Right</button>
              <button onClick={() => setPromptAndGenerate("Extreme head rotation to the left")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Rotate Left</button>
              <button onClick={() => setPromptAndGenerate("Extreme head rotation to the right")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">Rotate Right</button>
            </div>
          </div>

          {/* Quick Edits */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 font-semibold">Quick Edits</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPromptAndGenerate("Remove background, make it clean white")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">🔲 White BG</button>
              <button onClick={() => setPromptAndGenerate("Enhance image quality and sharpness")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">✨ Enhance</button>
              <button onClick={() => setPromptAndGenerate("Make it look like a vintage photo")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">📷 Vintage</button>
              <button onClick={() => setPromptAndGenerate("Add artistic blur to background, keep subject sharp")} disabled={isGenerating || !currentActiveId} className="text-xs bg-white px-3 py-1.5 rounded-full hover:bg-gray-50 border border-gray-300 transition disabled:opacity-50">🎯 Bokeh</button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace - History Feed */}
      <div className="flex-1 bg-white relative flex flex-col h-screen overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "radial-gradient(#475569 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        {/* Scrollable Feed */}
        <div ref={feedContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth pb-32">
          {/* Empty State */}
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center mt-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 mx-auto border border-zinc-800 shadow-xl">
                <Wand2 className="w-8 h-8 text-zinc-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Start Your Edit Session</h2>
              <p className="text-gray-600 mt-2 max-w-sm mx-auto text-sm">Upload a photo. Each edit you make will generate a new version below the previous one.</p>
            </div>
          )}

          {/* History Timeline */}
          {history.map((item, index) => (
            <div key={item.id} className="flex flex-col items-center w-full max-w-2xl mx-auto mb-8 relative group shrink-0">
              {!item.isOriginal && (
                <div className="absolute -top-10 left-1/2 w-0.5 h-10 bg-gray-50" />
              )}
              <div className={`bg-white rounded-2xl border shadow-xl overflow-hidden w-full relative ${currentActiveId === item.id ? "border-zinc-500" : "border-gray-200"
                }`}>
                <div className="bg-gray-100/50 p-3 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      {item.isOriginal ? "Original" : `Version ${index + 1}`}
                    </span>
                    {currentActiveId === item.id && (
                      <span className="text-[10px] bg-zinc-600 text-white px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">{item.timestamp.toLocaleTimeString()}</div>
                </div>
                <div className="relative bg-gray-100 min-h-[200px] flex items-center justify-center p-2">
                  <img
                    src={`data:${item.mimeType};base64,${item.base64}`}
                    className="max-h-[500px] rounded object-contain shadow-lg"
                    style={{ minHeight: "200px", display: "block" }}
                    alt={item.isOriginal ? "Original" : `Version ${index + 1}`}
                  />
                </div>
                <div className="p-4 bg-white border-t border-gray-200">
                  <p className="text-sm text-gray-700 italic mb-3">
                    {item.isOriginal ? "Source Upload" : `"${item.prompt}"`}
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200/50">
                    <div className="flex gap-2">
                      <button onClick={() => downloadItem(item.id)} className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 transition">
                        <Download className="w-3 h-3" /> Save
                      </button>
                      {!item.isOriginal && (
                        <button onClick={() => retryGeneration(item.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition ml-2" title="Discard this and try again">
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </div>
                    {currentActiveId !== item.id && (
                      <button onClick={() => resumeFrom(item.id)} className="text-xs px-3 py-1 bg-gray-50 hover:bg-gray-200 text-gray-800 rounded-full transition flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <GitBranch className="w-3 h-3" /> Resume from here
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-8">
              <img
                src="/frog-rolling.gif"
                alt="Loading..."
                className="w-10 h-10 mb-4"
              />
              <p className="text-gray-600 font-mono text-xs tracking-widest uppercase">Generating next version...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
