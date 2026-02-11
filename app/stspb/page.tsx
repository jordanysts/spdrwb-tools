'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';

const AI_PRESETS = [
    {
        id: 'subtropic',
        label: 'Subtropic Beach',
        prompt: `EDIT THIS PHOTO - Transport user to a lunar subtropic beach.

🚨 KEEP IDENTICAL (DO NOT CHANGE):
- User's FACE: exact copy - eyes, nose, mouth, jawline, skin tone
- User's CLOTHING: same outfit/colors from input
- User's HAIR: same style/color

✅ MUST ADJUST (REQUIRED):
- User's POSE: adjust naturally for the scene - relaxed beach selfie pose
- Make it look like they're actually ON the moon, not standing awkwardly

SCENE:
- Sunny subtropic beach ON THE MOON
- Lush subtropic jungle vegetation in background
- Earth visible in the sky
- Proper lunar lighting and atmosphere
- Selfie POV framing

The user must be INSTANTLY recognizable - their face should be COPIED from the input.`,
        loadingMessages: ['Launching to the Moon', 'Finding the perfect lunar beach', 'Adjusting moon lighting', "Say 'Subtropic!'"]
    },
];

const DEFAULT_LOADING_MESSAGES = ['Creating your masterpiece', 'AI is thinking hard', 'Almost there', 'Mixing digital paint', 'Consulting the algorithm'];

// Keyword-based loading messages for custom prompts
const KEYWORD_MESSAGES: Record<string, string[]> = {
    'jungle': ['Pushing through vines', 'Listening to exotic birds', 'Feeling the humidity', 'Navigating dense foliage'],
    'tropical': ['Soaking in tropical vibes', 'Finding paradise', 'Adjusting to the heat', 'Enjoying island life'],
    'subtropic': ['Entering lush vegetation', 'Spotting wildlife', 'Breathing fresh jungle air', 'Immersed in nature'],
    'orange': ['Putting on orange shirt', 'Bold and vibrant', 'Standing out in jungle', 'Orange you glad'],
    'green': ['Green sunglasses on', 'Matching the foliage', 'Blending with nature', 'Going green'],
    'sunglasses': ['Shades on', 'Looking cool', 'Protecting from rays', 'Style engaged'],
};

// Generate contextual messages from custom prompt
const getMessagesFromPrompt = (prompt: string): string[] => {
    const lowerPrompt = prompt.toLowerCase();
    const matchedMessages: string[] = [];

    for (const [keyword, messages] of Object.entries(KEYWORD_MESSAGES)) {
        if (lowerPrompt.includes(keyword)) {
            matchedMessages.push(...messages);
        }
    }

    if (matchedMessages.length > 0) {
        // Shuffle and return up to 5 messages
        return matchedMessages.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    return DEFAULT_LOADING_MESSAGES;
};

export default function PhotoboothV2Page() {
    // Locked to 'ai' mode
    const mode = 'ai';
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [showFlash, setShowFlash] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    // AI Mode states
    // Default to Flatiron Pinky
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(AI_PRESETS[0].id);
    const [customPrompt, setCustomPrompt] = useState(AI_PRESETS[0].prompt);

    const [aiPhoto, setAiPhoto] = useState<string | null>(null);
    const [generatedPhoto, setGeneratedPhoto] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showPhotoPreview, setShowPhotoPreview] = useState(false); // Preview before loading
    const [photoSlideOut, setPhotoSlideOut] = useState(false); // Trigger slide-out animation
    const [photoShake, setPhotoShake] = useState(false); // Trigger shake before slide
    const [finalLoadingMessage, setFinalLoadingMessage] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [showQrModal, setShowQrModal] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const aiVideoRef = useRef<HTMLVideoElement>(null);
    const presetScrollRef = useRef<HTMLDivElement>(null);

    // Start camera
    const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
        setIsLoading(true);
        setError(null);

        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                }
            });

            streamRef.current = stream;

            if (aiVideoRef.current) {
                aiVideoRef.current.srcObject = stream;
                try {
                    await aiVideoRef.current.play();
                } catch (e) { }
            }

            setIsLoading(false);
        } catch (err: any) {
            console.error('Camera error:', err);
            setError('Camera access denied. Please allow camera permissions.');
            setIsLoading(false);
        }
    }, [facingMode]);

    // Toggle camera
    const toggleCamera = useCallback(async () => {
        const newFacing = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacing);
        await startCamera(newFacing);
    }, [facingMode, startCamera]);

    useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (streamRef.current && aiVideoRef.current && !aiVideoRef.current.srcObject) {
            aiVideoRef.current.srcObject = streamRef.current;
            aiVideoRef.current.play().catch(() => { });
        }
    }, [aiPhoto, generatedPhoto]);

    // Capture frame - only flip for front camera
    const captureFrame = useCallback((videoEl: HTMLVideoElement | null): string | null => {
        if (!videoEl) return null;

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Only flip horizontally for front camera (selfie mode)
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(videoEl, 0, 0);

        return canvas.toDataURL('image/png');
    }, [facingMode]);

    // Apply preset to custom prompt
    const applyPreset = (presetId: string, presetPrompt: string) => {
        setSelectedPresetId(presetId);
        setCustomPrompt(presetPrompt);
    };

    // Cycle loading messages when generating
    useEffect(() => {
        if (!isGenerating) {
            setLoadingMessageIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setLoadingMessageIndex(prev => prev + 1);
        }, 3500);

        return () => clearInterval(interval);
    }, [isGenerating]);

    // Get current loading message based on preset or custom prompt keywords
    const getCurrentLoadingMessage = () => {
        // If we have a final message (like "Say 'Pink'!"), show that
        if (finalLoadingMessage) return finalLoadingMessage;

        // First check if a preset is selected
        const preset = AI_PRESETS.find(p => p.id === selectedPresetId);
        if (preset?.loadingMessages) {
            // Loop messages smoothly
            return preset.loadingMessages[loadingMessageIndex % preset.loadingMessages.length];
        }

        // Otherwise, analyze the custom prompt for keywords
        const promptMessages = getMessagesFromPrompt(customPrompt);
        return promptMessages[loadingMessageIndex % promptMessages.length];
    };

    // Check if we should show the subtext (hide it for final message)
    const shouldShowSubtext = () => {
        return !finalLoadingMessage;
    };

    // Add watermark to image
    const addWatermark = (imageDataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous'; // CORS fix for external URLs
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(imageDataUrl);
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Add watermark with shadow/outline
                const fontSize = Math.max(img.width * 0.0275, 15); // Increased from 0.025 to 0.0275 (10% bigger)
                ctx.font = `${fontSize}px Inter, sans-serif`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';

                const padding = img.width * 0.03;
                const text = 'built by spdr.studio';
                const x = img.width - padding;
                const y = img.height - padding;

                // Draw subtle dark outline for visibility (reduced from 0.6 to 0.3 opacity)
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = fontSize * 0.05; // Reduced from 0.08 to 0.05
                ctx.strokeText(text, x, y);

                // Draw white text on top
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillText(text, x, y);

                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = imageDataUrl;
        });
    };

    // Normalize image to ensure compatibility across all devices
    const normalizeImage = (imageDataUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.onload = () => {
                try {
                    // Create canvas to normalize the image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Optimize image size - resize to max 768px for faster processing (Subtropic optimization)
                    const MAX_SIZE = 768;
                    let width = img.width;
                    let height = img.height;

                    console.log(`Original image size: ${width}x${height}`);

                    // Resize if larger than max size
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                        console.log(`Resized to: ${width}x${height}`);
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw image to canvas (this normalizes and resizes)
                    ctx.drawImage(img, 0, 0, width, height);

                    // Detect mobile for quality optimization
                    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
                    const quality = isMobile ? 0.85 : 0.92;

                    // Convert to JPEG with optimized quality
                    const normalizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    console.log(`Final image size: ${Math.round(normalizedDataUrl.length / 1024)}KB`);
                    resolve(normalizedDataUrl);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            img.src = imageDataUrl;
        });
    };

    // Generate AI photo
    const generateAiPhoto = async (photo: string) => {
        if (!photo || !customPrompt.trim()) return;

        setIsGenerating(true);
        setAiError(null);
        setGeneratedPhoto(null);
        setFinalLoadingMessage(null);
        setLoadingMessageIndex(0);

        try {
            // Normalize the image first to ensure compatibility
            console.log('Normalizing image for all device compatibility...');
            const normalizedPhoto = await normalizeImage(photo);
            console.log('Image normalized successfully');

            // No preset-specific modifications needed for subtropic
            let fullPrompt = customPrompt;

            const response = await fetch('/api/ai-photo-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: normalizedPhoto,
                    presetId: selectedPresetId,
                    prompt: customPrompt
                }),
            });

            // Handle non-OK responses
            if (!response.ok) {
                // Try to parse error response
                let errorMessage = `Server error (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || errorMessage;
                } catch {
                    // If JSON parsing fails, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                setAiError(errorMessage);
                setIsGenerating(false);
                return;
            }

            // Try to parse successful response
            let data;
            try {
                const text = await response.text();
                if (!text) {
                    throw new Error('Empty response from server');
                }
                data = JSON.parse(text);
            } catch (parseError: any) {
                console.error('JSON parse error:', parseError);
                setAiError('Server returned invalid response. Please try again.');
                setIsGenerating(false);
                return;
            }

            if (data.error) {
                setAiError(data.error + (data.details ? `: ${data.details}` : ''));
                setIsGenerating(false);
            } else if (data.image) {
                // No watermark or QR code for Subtropic (speed optimization)
                const finalImage = data.image;

                // Show result immediately
                setIsGenerating(false);
                setGeneratedPhoto(finalImage);
            } else {
                setAiError('No image was generated');
                setIsGenerating(false);
            }
        } catch (err: any) {
            console.error('AI generation error:', err);
            // Handle network errors and other exceptions
            if (err.name === 'AbortError' || err.message?.includes('timeout')) {
                setAiError('Request timed out. Please try again.');
            } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
                setAiError('Network error. Please check your connection and try again.');
            } else {
                setAiError(err.message || 'Failed to generate image');
            }
            setIsGenerating(false);
        }
    };

    // AI Mode capture with animation sequence
    const handleAiCapture = () => {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 200);

        const photo = captureFrame(aiVideoRef.current);
        if (photo) {
            setAiPhoto(photo);
            setGeneratedPhoto(null);
            setAiError(null);
            setShowPhotoPreview(true);
            setPhotoSlideOut(false);
            setPhotoShake(false);
            setIsGenerating(false);

            // Step 1: Show photo preview for 2 seconds
            setTimeout(() => {
                // Step 2: Shake for 0.5s
                setPhotoShake(true);

                // Step 3: After shake completes, reset and trigger slide-out
                setTimeout(() => {
                    // Reset shake first
                    setPhotoShake(false);

                    // Small delay ensures state update before slide  
                    setTimeout(() => {
                        setPhotoSlideOut(true);

                        // Step 4: After slide-out, start AI generation
                        setTimeout(() => {
                            setShowPhotoPreview(false);
                            setIsGenerating(true);
                            generateAiPhoto(photo);
                        }, 3000);
                    }, 50);
                }, 500);
            }, 2000);
        }
    };

    const resetAi = () => {
        setAiPhoto(null);
        setGeneratedPhoto(null);
        setAiError(null);
        setFinalLoadingMessage(null);
        setShowPhotoPreview(false);
        setPhotoSlideOut(false);
        setQrCodeUrl(null);
        // Don't reset preset/prompt so user can easily retake with same settings
    };

    const saveSinglePhoto = async (photoUrl?: string) => {
        const photo = photoUrl || generatedPhoto || aiPhoto;
        if (!photo) return;

        if (navigator.share && navigator.canShare) {
            try {
                const response = await fetch(photo);
                const blob = await response.blob();
                const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file] });
                    // if (!photoUrl) setCapturedPhoto(null); // No capture photo state in V2 specific flow
                    return;
                }
            } catch (err) { }
        }

        const link = document.createElement('a');
        link.download = `photo-${Date.now()}.png`;
        link.href = photo;
        link.click();
    };

    // Video transform style - only mirror for front camera
    const videoStyle = facingMode === 'user' ? { transform: 'scaleX(-1)' } : {};

    return (
        <main className="fixed inset-0 bg-gray-50 text-black overflow-hidden flex items-center justify-center">


            <div className="relative w-full h-full bg-white">
                <div className="absolute top-4 left-4 z-50">
                    <Link
                        href="/"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 hover:text-black text-lg shadow-md border border-gray-200"
                    >
                        ←
                    </Link>
                </div>

                {/* Camera Toggle Button */}
                <button
                    onClick={toggleCamera}
                    className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-gray-700 hover:text-black text-lg shadow-md border border-gray-200"
                >
                    🔄
                </button>

                {/* AI Mode View */}
                {!generatedPhoto && (
                    <div className="absolute inset-0 flex flex-col bg-black">
                        {/* Camera Preview */}
                        <div className="flex-1 relative min-h-0">
                            {/* If we have captured but are generating, showing the static photo behind overlay might be nice, 
                                but showing live camera is also fine. Let's show captured if available. */}
                            {aiPhoto ? (
                                <img src={aiPhoto} alt="Captured" className="w-full h-full object-cover" />
                            ) : (
                                <video
                                    ref={aiVideoRef}
                                    className="w-full h-full object-cover"
                                    style={videoStyle}
                                    playsInline
                                    muted
                                    autoPlay
                                />
                            )}

                            {/* Preset selector hidden - only one preset */}

                            {/* Capture Button */}
                            {!isGenerating && !aiPhoto && (
                                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                                    <button
                                        onClick={handleAiCapture}
                                        className="w-[72px] h-[72px] rounded-full p-[5px] border-[3px] border-white/70 active:scale-95 transition-transform"
                                    >
                                        <div className="w-full h-full rounded-full bg-white" />
                                    </button>
                                </div>
                            )}

                            {/* Generating Overlay */}
                            {isGenerating && (
                                <div className="absolute inset-0 bg-black/[0.585] flex items-center justify-center z-50 backdrop-blur-sm">
                                    <div className="text-center px-8 animate-fade-in">
                                        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
                                        <p key={loadingMessageIndex} className="text-white text-lg font-medium animate-fade-in">
                                            {getCurrentLoadingMessage()}{!finalLoadingMessage && '...'}
                                        </p>
                                        <p className="text-white/60 text-xs mt-4 font-mono">This may take 10-15 seconds</p>
                                    </div>
                                </div>
                            )}

                            {/* Photo Preview Animation - Show before loading */}
                            {showPhotoPreview && aiPhoto && (
                                <div className="absolute inset-0 bg-black/[0.585] backdrop-blur-sm flex items-center justify-center z-50">
                                    <div className="relative">
                                        {/* Animated glow effect behind image - pulses for motion */}
                                        <div className="absolute inset-0 bg-gradient-radial from-gray-800/30 via-orange-400/10 to-transparent blur-3xl scale-110 animate-pulse-slow"></div>
                                        <img
                                            src={aiPhoto}
                                            alt="Preview"
                                            className={`relative w-[50vw] h-auto object-contain ${photoSlideOut
                                                ? 'transition-all duration-[3000ms] ease-in-out translate-y-[-150%] opacity-0 scale-90'
                                                : photoShake
                                                    ? 'animate-[shake_0.5s_ease-in-out]'
                                                    : 'animate-[scale-in_0.7s_ease-out]'
                                                }`}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Flash effect */}
                            {showFlash && (
                                <div className="absolute inset-0 bg-white z-[60]"></div>
                            )}


                        </div>
                    </div>
                )}

                {/* AI Generated Result */}
                {generatedPhoto && (
                    <div className="absolute inset-0 z-[100] bg-gray-50 flex flex-col animate-fade-in">
                        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                            {/* Result Image */}
                            <img
                                src={generatedPhoto}
                                alt="AI Generated"
                                className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-2xl animate-[bounce-in_0.6s_ease-out]"
                            />
                        </div>

                        <div className="p-6 pb-safe flex flex-col gap-3 items-center bg-gradient-to-t from-white via-gray-50 to-transparent">
                            <div className="flex justify-center gap-3 w-full max-w-sm">
                                <button
                                    onClick={resetAi}
                                    className="flex-1 px-6 py-3.5 border-2 border-gray-300 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-all hover:bg-gray-100 hover:border-gray-400"
                                >
                                    Take Another
                                </button>
                                <button
                                    onClick={() => saveSinglePhoto(generatedPhoto)}
                                    className="flex-1 px-6 py-3.5 bg-gray-900 text-white rounded-full text-sm font-bold active:scale-95 transition-all hover:bg-gray-800 shadow-lg"
                                >
                                    Save Photo
                                </button>
                            </div>

                            {/* QR Code Button */}
                            {qrCodeUrl && (
                                <button
                                    onClick={() => setShowQrModal(true)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-full text-xs font-medium transition-all border border-gray-300"
                                >
                                    Show QR Code
                                </button>
                            )}
                        </div>

                        {/* QR Code Modal */}
                        {showQrModal && qrCodeUrl && (
                            <div
                                className="absolute inset-0 bg-black/80 flex items-center justify-center z-[110] backdrop-blur-md p-6"
                                onClick={() => setShowQrModal(false)}
                            >
                                <div className="flex flex-col items-center gap-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                                    <p className="text-white text-sm uppercase tracking-widest font-medium text-center">
                                        Scan to Save on Other Devices
                                    </p>
                                    <div className="bg-white p-4 rounded-2xl shadow-2xl">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                                    </div>
                                    <button
                                        onClick={() => setShowQrModal(false)}
                                        className="w-full px-6 py-3 bg-white text-gray-900 rounded-full text-sm font-medium transition-colors hover:bg-gray-100"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
                        <div className="text-center">
                            <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-white/70 text-sm">Starting camera...</p>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 z-50">
                        <div className="text-center max-w-sm">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button onClick={() => startCamera()} className="px-5 py-2 bg-white text-black rounded-full text-sm font-medium">Try Again</button>
                        </div>
                    </div>
                )}

                {/* AI Error */}
                {aiError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 z-[60]">
                        <div className="text-center max-w-sm">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-500 text-2xl">!</div>
                            <h3 className="text-white font-bold mb-2">Generation Failed</h3>
                            <p className="text-white/70 mb-6 text-sm">{aiError}</p>
                            <button onClick={resetAi} className="px-6 py-3 bg-white text-black rounded-full text-sm font-medium">Try Again</button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
