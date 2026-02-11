"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Sparkles, Image as ImageIcon, Square, RectangleHorizontal, RectangleVertical, Maximize2, X, Grid3x3, Wand2, Upload } from "lucide-react";
import SpiderWebIcon from "@/components/SpiderWebIcon";
import { generateImageAction } from "./actions";

// Prompt presets with templates
const PROMPT_PRESETS = [
    {
        id: 'photoreal',
        label: 'Photoreal',
        template: 'Ultra-realistic photograph of [SUBJECT]. Shot on Canon EOS R5, 85mm lens, f/1.8 aperture. Natural lighting, sharp focus, 8K resolution. Photorealistic skin texture, accurate shadows and reflections.',
        description: 'Photorealistic image generation'
    },
    {
        id: 'illustration',
        label: 'Illustration',
        template: 'Beautiful digital illustration of [SUBJECT]. Stylized art style with clean lines, vibrant colors, and artistic composition. Professional concept art quality, detailed rendering.',
        description: 'Stylized digital art'
    },
    {
        id: 'isolate',
        label: 'Isolate',
        template: 'isolate and separate [SUBJECT] in grid layout on white background',
        description: 'Objects on white background'
    },
    {
        id: 'spritesheet',
        label: 'Sprite Sheet',
        template: 'Game sprite sheet showing [SUBJECT]. Create a grid of [ROWS]x[COLS] animation frames. Pixel-perfect alignment, consistent style, transparent or solid color background. Each frame shows a different pose or animation state.',
        description: 'Animation sprite sheets',
        hasGrid: true
    },
];

interface GeneratedImage {
    url: string;
    aspectRatio: string;
    imageSize: string;
    index: number;
}

export default function ImageGeneratorPage() {
    const [prompt, setPrompt] = useState("");
    const [subjectText, setSubjectText] = useState(""); // Tracks user's original subject input
    const [model, setModel] = useState("flux-klein");
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [spriteRows, setSpriteRows] = useState(2);
    const [spriteCols, setSpriteCols] = useState(4);
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K"); // Default to 1K
    const [variations, setVariations] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Apply preset with subject auto-fill
    const applyPreset = (presetId: string) => {
        const preset = PROMPT_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        setSelectedPreset(presetId);

        // Get the subject text (current prompt if no preset, or saved subjectText)
        const subject = !selectedPreset && prompt.trim() ? prompt.trim() : subjectText;

        // Build template with subject filled in
        let template = preset.template;
        if (preset.hasGrid) {
            template = template.replace('[ROWS]', String(spriteRows)).replace('[COLS]', String(spriteCols));
        }

        // Replace [SUBJECT] with user's text if available
        if (subject) {
            template = template.replace('[SUBJECT]', subject);
        }

        setPrompt(template);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError("");
        setGeneratedImages([]);
        setProgress({ current: 0, total: variations });

        try {
            // Create array of promises for concurrent generation, but show results as they complete
            const generationPromises = Array.from({ length: variations }, async (_, index) => {
                try {
                    const result = await generateImageAction({
                        prompt: prompt,
                        aspectRatio: aspectRatio,
                        imageSize: imageSize,
                        model: model,
                        image: uploadedImage,
                    });

                    // Update progress
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));

                    if (result.success && result.output) {
                        const newImage = {
                            url: String(result.output),
                            aspectRatio,
                            imageSize,
                            index: index + 1,
                        };

                        // Add image to display immediately as it completes
                        setGeneratedImages(prev => [...prev, newImage]);

                        return newImage;
                    } else {
                        throw new Error(result.error || "Generation failed");
                    }
                } catch (err) {
                    throw err;
                }
            });

            // Wait for all to complete (even though we're showing them as they finish)
            await Promise.all(generationPromises);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
            console.error(err);
        } finally {
            setIsGenerating(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const downloadImage = (image: GeneratedImage) => {
        const link = document.createElement("a");
        link.href = image.url;
        link.download = `generated-image-${image.index}-${Date.now()}.jpg`;
        link.click();
    };

    const downloadAll = () => {
        generatedImages.forEach((image, index) => {
            setTimeout(() => {
                const link = document.createElement("a");
                link.href = image.url;
                link.download = `generated-image-${index + 1}-${Date.now()}.jpg`;
                link.click();
            }, index * 200);
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">AI Image Generator</h1>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Controls */}
                    <div className="space-y-6">
                        {/* Prompt Input with Presets */}
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden p-6 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-gray-900" />
                                    <span className="font-medium text-gray-800">Prompt</span>
                                </div>
                            </div>

                            {/* Prompt Presets */}
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500">Style Presets</label>
                                <div className="flex flex-wrap gap-2">
                                    {PROMPT_PRESETS.map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyPreset(preset.id)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${selectedPreset === preset.id
                                                ? "bg-gray-800 text-white border-gray-800"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                                }`}
                                            title={preset.description}
                                        >
                                            <Wand2 className="w-3 h-3 inline mr-1" />
                                            {preset.label}
                                        </button>
                                    ))}
                                    {selectedPreset && (
                                        <button
                                            onClick={() => {
                                                setSelectedPreset(null);
                                                setPrompt(subjectText); // Restore original subject
                                            }}
                                            className="px-2 py-1.5 rounded-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Sprite Sheet Grid Size (only show when spritesheet preset selected) */}
                            {selectedPreset === 'spritesheet' && (
                                <div className="flex gap-4 p-3 bg-white/50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600">Rows:</label>
                                        <input
                                            type="number"
                                            value={spriteRows}
                                            onChange={(e) => {
                                                const val = Math.max(1, Math.min(8, parseInt(e.target.value) || 2));
                                                setSpriteRows(val);
                                                // Update prompt with new value
                                                setPrompt(prev => prev.replace(/\d+x\d+/, `${val}x${spriteCols}`));
                                            }}
                                            min={1}
                                            max={8}
                                            className="w-12 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-center"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600">Cols:</label>
                                        <input
                                            type="number"
                                            value={spriteCols}
                                            onChange={(e) => {
                                                const val = Math.max(1, Math.min(8, parseInt(e.target.value) || 4));
                                                setSpriteCols(val);
                                                // Update prompt with new value
                                                setPrompt(prev => prev.replace(/\d+x\d+/, `${spriteRows}x${val}`));
                                            }}
                                            min={1}
                                            max={8}
                                            className="w-12 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-center"
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500 self-center">= {spriteRows * spriteCols} frames</span>
                                </div>
                            )}

                            <textarea
                                value={prompt}
                                onChange={(e) => {
                                    setPrompt(e.target.value);
                                    // Track subject text when no preset is selected
                                    if (!selectedPreset) {
                                        setSubjectText(e.target.value);
                                    }
                                }}
                                placeholder="A futuristic city with neon lights, cinematic lighting... or select a preset above"
                                className="w-full h-32 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-gray-800 resize-none"
                            />

                            <div className="flex justify-between items-center">
                                {prompt.includes('[SUBJECT]') && (
                                    <p className="text-xs text-gray-900">💡 Replace [SUBJECT] with your description</p>
                                )}
                                <div className="text-xs text-gray-500 ml-auto">
                                    {prompt.length} characters
                                </div>
                            </div>

                            {/* Upload Image */}
                            <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-4">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-gray-700 hover:border-gray-300 transition-colors"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload Reference Image
                                    </button>
                                    <p className="text-xs text-gray-500 mt-1">Optional: Upload image for style transfer or isolation</p>
                                </div>

                                {uploadedImage && (
                                    <div className="flex items-center gap-2">
                                        <img src={uploadedImage} alt="Uploaded" className="w-20 h-20 object-cover rounded-lg border border-gray-300 shadow-sm" />
                                        <button
                                            onClick={() => setUploadedImage(null)}
                                            className="p-1 text-gray-400 hover:text-red-500"
                                            title="Remove image"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Parameters */}
                        <div className="bg-gray-100 rounded-lg border border-gray-200 p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Maximize2 className="w-4 h-4 text-gray-900" />
                                <span className="font-medium text-gray-800">Image Settings</span>
                            </div>

                            {/* Model Selection */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-600">AI Model</label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800"
                                >
                                    <option value="flux-klein">FLUX Klein - Fastest</option>
                                    <option value="seedream">SeeDream 4.5 - Artistic</option>
                                    <option value="gemini-flash">Nano Banana - Quality</option>
                                    <option value="gemini-pro">Nano Banana Pro - Consistent</option>
                                </select>
                                <p className="text-xs text-gray-500">
                                    {model === "flux-klein"
                                        ? "Lightning fast generation with excellent prompt following"
                                        : model === "seedream"
                                            ? "Cinematic aesthetics with artistic style"
                                            : model === "gemini-flash"
                                                ? "High quality output with great detail"
                                                : "Most consistent results with advanced reasoning"}
                                </p>
                            </div>

                            {/* Variations */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-600 flex items-center gap-2">
                                    <Grid3x3 className="w-3 h-3" />
                                    Variations
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4].map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => setVariations(num)}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${variations === num
                                                ? "bg-white text-gray-900 border-gray-800"
                                                : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                                }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aspect Ratio */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-600">Aspect Ratio</label>
                                <div className="grid grid-cols-5 gap-2">
                                    <button
                                        onClick={() => setAspectRatio("1:1")}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1 ${aspectRatio === "1:1"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        <Square className="w-4 h-4" />
                                        1:1
                                    </button>
                                    <button
                                        onClick={() => setAspectRatio("16:9")}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1 ${aspectRatio === "16:9"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        <RectangleHorizontal className="w-4 h-4" />
                                        16:9
                                    </button>
                                    <button
                                        onClick={() => setAspectRatio("9:16")}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1 ${aspectRatio === "9:16"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        <RectangleVertical className="w-4 h-4" />
                                        9:16
                                    </button>
                                    <button
                                        onClick={() => setAspectRatio("4:3")}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1 ${aspectRatio === "4:3"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        <RectangleHorizontal className="w-3 h-3" />
                                        4:3
                                    </button>
                                    <button
                                        onClick={() => setAspectRatio("3:4")}
                                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1 ${aspectRatio === "3:4"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        <RectangleVertical className="w-3 h-3" />
                                        3:4
                                    </button>
                                </div>
                            </div>

                            {/* Image Resolution */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-600">Image Resolution</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setImageSize("1K")}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${imageSize === "1K"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        1K
                                    </button>
                                    <button
                                        onClick={() => setImageSize("2K")}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${imageSize === "2K"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        2K
                                    </button>
                                    <button
                                        onClick={() => setImageSize("4K")}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${imageSize === "4K"
                                            ? "bg-white text-gray-900 border-gray-800"
                                            : "bg-gray-100/50 text-gray-600 border-zinc-800 hover:bg-white/50"
                                            }`}
                                    >
                                        4K
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">Higher resolution takes longer to generate</p>
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-white"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating {progress.current} of {progress.total}...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate {variations > 1 ? `${variations} Variations` : "Image"}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Column - Result */}
                    <div className="space-y-6">
                        <div className={`bg-gray-100 rounded-lg border border-gray-200 overflow-hidden ${generatedImages.length > 0 ? '' : 'min-h-[400px]'}`}>
                            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">Generated Images</span>
                                    {generatedImages.length > 0 && (
                                        <span className="text-xs text-gray-900 ml-2">
                                            {generatedImages.length} • {aspectRatio} • {imageSize}
                                        </span>
                                    )}
                                </div>
                                {generatedImages.length > 0 && (
                                    <button
                                        onClick={downloadAll}
                                        className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors text-xs flex items-center gap-1"
                                        title="Download All"
                                    >
                                        <Download className="w-3 h-3 text-gray-700" />
                                        <span className="text-gray-700">All</span>
                                    </button>
                                )}
                            </div>
                            <div className="p-6 h-[calc(100%-48px)] flex items-center justify-center bg-white overflow-auto">
                                {/* Show images grid when we have images OR are generating */}
                                {(generatedImages.length > 0 || isGenerating) ? (
                                    <div className="w-full h-full">
                                        <div className={`grid gap-4 w-full p-2 ${variations === 1 ? "grid-cols-1" :
                                            variations === 2 ? "grid-cols-2" :
                                                "grid-cols-2"
                                            }`}>
                                            {/* Show completed images */}
                                            {generatedImages.map((image) => (
                                                <div
                                                    key={image.index}
                                                    className="relative group cursor-pointer bg-white rounded overflow-hidden flex items-center justify-center aspect-square"
                                                    onClick={() => setSelectedImage(image)}
                                                >
                                                    <img
                                                        src={image.url}
                                                        alt={`Generated ${image.index}`}
                                                        className="max-h-full max-w-full object-contain"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    downloadImage(image);
                                                                }}
                                                                className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                                                            >
                                                                <Download className="w-4 h-4 text-zinc-900" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Show loading placeholders for remaining images */}
                                            {isGenerating && Array.from({ length: variations - generatedImages.length }).map((_, idx) => (
                                                <div
                                                    key={`loading-${idx}`}
                                                    className="bg-white rounded overflow-hidden flex items-center justify-center aspect-square"
                                                >
                                                    <div className="text-center flex flex-col items-center p-4">
                                                        <img
                                                            src="/frog-rolling.gif"
                                                            alt="Loading..."
                                                            className="w-8 h-8 mb-2"
                                                        />
                                                        <p className="text-gray-600 text-xs">Generating...</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : generatedImages.length > 0 ? (
                                    <div className={`grid gap-4 w-full h-full p-2 ${generatedImages.length === 1 ? "grid-cols-1" :
                                        generatedImages.length === 2 ? "grid-cols-2" :
                                            "grid-cols-2"
                                        }`}>
                                        {generatedImages.map((image) => (
                                            <div
                                                key={image.index}
                                                className="relative group cursor-pointer bg-white rounded overflow-hidden flex items-center justify-center"
                                                onClick={() => setSelectedImage(image)}
                                            >
                                                <img
                                                    src={image.url}
                                                    alt={`Generated ${image.index}`}
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                downloadImage(image);
                                                            }}
                                                            className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                                                        >
                                                            <Download className="w-4 h-4 text-zinc-900" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <ImageIcon className="w-10 h-10 mx-auto text-gray-500 mb-3" />
                                        <p className="text-gray-600 text-sm">Your generated images will appear here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(selectedImage);
                        }}
                        className="absolute top-4 right-16 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <Download className="w-6 h-6 text-white" />
                    </button>
                    <img
                        src={selectedImage.url}
                        alt={`Generated ${selectedImage.index}`}
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded">
                        Variation #{selectedImage.index} • {selectedImage.aspectRatio} • {selectedImage.imageSize}
                    </div>
                </div>
            )}
        </div>
    );
}
