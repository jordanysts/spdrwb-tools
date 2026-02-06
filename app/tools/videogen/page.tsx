'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Video, Loader2, Play, Upload, Image as ImageIcon, Sparkles, Download, Sliders, Volume2, VolumeX } from 'lucide-react';
import { generateVideo, getCredits } from './actions';

export default function VideoGenPage() {
    const [prompt, setPrompt] = useState('Camera slowly moves horizontally.');
    const [imageUrl, setImageUrl] = useState('');
    const [endImageUrl, setEndImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultVideo, setResultVideo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [model, setModel] = useState('gen4_turbo'); // 'gen4_turbo' | 'veo3'
    const [progress, setProgress] = useState(0);
    const [credits, setCredits] = useState<number | null>(null);


    // Settings
    const [ratio, setRatio] = useState('1280:720'); // 16:9
    const [duration, setDuration] = useState(5); // Default to 5s (Gen-4)
    const [includeAudio, setIncludeAudio] = useState(false);

    // For drag and drop (start image)
    const fileInputRef = useRef<HTMLInputElement>(null);
    // For end image
    const endFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch credits on mount
    useEffect(() => {
        const fetchCredits = async () => {
            const data = await getCredits();
            if (data) {
                setCredits(data.creditBalance);
            }
        };
        fetchCredits();
    }, []);

    // Progress simulation
    useEffect(() => {
        if (loading) {
            setProgress(0);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) return 95;
                    return prev + 1;
                });
            }, 800);
            return () => clearInterval(interval);
        } else {
            setProgress(0);
        }
    }, [loading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEndFrame: boolean = false) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file, isEndFrame);
        }
    };

    const processFile = (file: File, isEndFrame: boolean) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (isEndFrame) {
                setEndImageUrl(reader.result as string);
            } else {
                setImageUrl(reader.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent, isEndFrame: boolean = false) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            processFile(file, isEndFrame);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleGenerate = async () => {


        // Gen-4 requires an image (Text-to-Video models are 403 Forbidden for this account)
        if (model === 'gen4_turbo' && !imageUrl) {
            setError('Runway Gen-4 Turbo requires a Start Frame image.');
            return;
        }

        if (!prompt.trim() && !imageUrl) {
            setError('Please provide a prompt or start image.');
            return;
        }

        setLoading(true);
        setError(null);
        setResultVideo(null);

        try {
            const result = await generateVideo(
                prompt,
                imageUrl,
                model,
                ratio,
                duration,
                endImageUrl,
                includeAudio
            );
            console.log('Result:', result);

            // @ts-ignore
            if (result && result.output && result.output.length > 0) {
                // @ts-ignore
                setResultVideo(result.output[0]);
                setProgress(100);
            } else {
                throw new Error('No video output received');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate video');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Link href="/tools" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                            <Video className="w-6 h-6" />
                            AI Video Tool
                            {credits !== null && (
                                <span className="ml-2 px-2 py-0.5 bg-orange-100 border border-orange-200 rounded text-orange-600 text-xs font-medium">
                                    {credits.toLocaleString()} credits
                                </span>
                            )}
                        </h1>

                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Controls */}
                    <div className="space-y-6">

                        {/* Model Selector */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-orange-500" />
                                <span className="font-medium text-gray-800 text-sm">Model Selection</span>
                            </div>
                            <select
                                value={model}
                                onChange={(e) => {
                                    const newModel = e.target.value;
                                    setModel(newModel);
                                    // Set optimal defaults per model
                                    if (newModel === 'veo3') setDuration(4);
                                    else setDuration(5);
                                }}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                            >
                                <option value="gen4_turbo">Runway Gen-4 Turbo (Fast & Stable)</option>
                                <option value="veo3">Google Veo 3 (via Runway)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2">
                                {model === 'gen4_turbo' ? 'Best for image-to-video. High consistency.' : 'Next-gen video model. Supports start/end frames.'}
                            </p>
                        </div>

                        {/* Advanced Settings */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Sliders className="w-4 h-4 text-orange-500" />
                                <span className="font-medium text-gray-800 text-sm">Settings</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-600 block mb-1">Aspect Ratio</label>
                                    <select
                                        value={ratio}
                                        onChange={(e) => setRatio(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="1280:720">16:9 Landscape</option>
                                        <option value="720:1280">9:16 Portrait</option>

                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600 block mb-1">Duration (Sec)</label>
                                    {model === 'veo3' ? (
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                        >
                                            <option value={4}>4 Seconds</option>
                                            <option value={6}>6 Seconds</option>
                                            <option value={8}>8 Seconds</option>
                                        </select>
                                    ) : (
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                        >
                                            <option value={5}>5 Seconds</option>
                                            <option value={10}>10 Seconds</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                            {model === 'veo3' && (
                                <div className="mt-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeAudio}
                                            onChange={(e) => setIncludeAudio(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 bg-gray-50 text-orange-500 focus:ring-orange-500"
                                        />
                                        <span className="text-sm text-gray-700 flex items-center gap-1">
                                            {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                            Generate with Audio
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Start Image Input */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-700">
                                    Start Frame {model === 'gen4_turbo' ? '(Required)' : '(Optional)'}
                                </span>
                            </div>

                            <div
                                onDrop={(e) => handleDrop(e, false)}
                                onDragOver={handleDragOver}
                                className="p-6 bg-white min-h-[200px] flex flex-col items-center justify-center relative transition-colors hover:bg-gray-50"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, false)}
                                    className="hidden"
                                />

                                {imageUrl ? (
                                    <div className="relative w-full h-64 group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={imageUrl}
                                            alt="Preview"
                                            className="w-full h-full object-contain rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm"
                                            >
                                                Change Image
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-center cursor-pointer"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                                            <Upload className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <p className="text-gray-700 text-sm font-medium mb-1">Click to upload image</p>
                                        <p className="text-gray-500 text-xs">or drag and drop here</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* End Frame Input (Veo only) */}
                        {model === 'veo3' && (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm text-gray-700">End Frame (Veo Only)</span>
                                </div>

                                <div
                                    onDrop={(e) => handleDrop(e, true)}
                                    onDragOver={handleDragOver}
                                    className="p-6 bg-white min-h-[150px] flex flex-col items-center justify-center relative transition-colors hover:bg-gray-50"
                                >
                                    <input
                                        ref={endFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, true)}
                                        className="hidden"
                                    />

                                    {endImageUrl ? (
                                        <div className="relative w-full h-40 group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={endImageUrl}
                                                alt="End Preview"
                                                className="w-full h-full object-contain rounded-lg"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => endFileInputRef.current?.click()}
                                                    className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm"
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => endFileInputRef.current?.click()}
                                            className="text-center cursor-pointer"
                                        >
                                            <p className="text-gray-700 text-sm font-medium mb-1">Upload End Frame</p>
                                            <p className="text-gray-500 text-xs">Optional</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Prompt Input */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <label className="text-sm text-gray-600 block mb-2">Motion Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the camera movement or subject action..."
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 min-h-[100px] resize-none"
                            />
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || (!imageUrl && !prompt && !endImageUrl)}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/10"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating Video...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 fill-current" />
                                    Generate Video
                                    <span className="ml-1 opacity-80 font-normal text-xs bg-white/20 px-2 py-0.5 rounded">
                                        ~{duration * 5} credits
                                    </span>
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Output */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm" style={{ height: 'fit-content', minHeight: '400px' }}>
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Video className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">Generated Output</span>
                                </div>
                                {resultVideo && (
                                    <a
                                        href={resultVideo}
                                        download="generated-video.mp4"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-orange-600 hover:text-orange-500 text-xs font-medium flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download
                                    </a>
                                )}
                            </div>

                            <div className="flex-1 bg-gray-100 flex items-center justify-center p-8 relative">
                                {loading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/frog-rolling.gif" alt="Loading" className="w-12 h-12" style={{ marginBottom: '21px' }} />
                                        <div className="w-64 bg-gray-300 rounded-full h-2 mb-2 overflow-hidden">
                                            <div
                                                className="bg-orange-500 h-full transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-gray-600 text-sm">{progress}% - Creating your masterpiece...</p>
                                    </div>
                                )}

                                {resultVideo ? (
                                    <video
                                        src={resultVideo}
                                        controls
                                        autoPlay
                                        loop
                                        className="w-full h-full max-h-[600px] object-contain rounded-lg shadow-2xl"
                                    />
                                ) : (
                                    <div className="text-center opacity-30">
                                        <Video className="w-24 h-24 mx-auto text-gray-400 mb-6" />
                                        <p className="text-gray-600 text-lg">Ready to Generate</p>
                                        <p className="text-gray-400 text-sm mt-2">Output will appear here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
