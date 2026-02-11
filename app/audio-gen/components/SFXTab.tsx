"use client";

import { useState, useRef } from "react";
import { Volume2, Loader2, Download, Play, Pause } from "lucide-react";
import { generateSoundEffect } from "../actions";

export function SFXTab() {
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState(1.0);
    const [promptInfluence, setPromptInfluence] = useState(0.3);
    const [loop, setLoop] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        if (!description.trim()) {
            setError("Please enter a sound description");
            return;
        }

        setIsGenerating(true);
        setError("");
        setAudioUrl(null);

        const result = await generateSoundEffect(description, duration, promptInfluence, loop);

        if (result.success && result.audio) {
            const audioBlob = `data:${result.mimeType};base64,${result.audio}`;
            setAudioUrl(audioBlob);
        } else {
            setError(result.error || "Failed to generate sound effect");
        }

        setIsGenerating(false);
    };

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const downloadAudio = () => {
        if (!audioUrl) return;
        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = `sfx-${Date.now()}.mp3`;
        link.click();
    };

    // Preset sound effect ideas
    const presets = [
        "Thunder rumbling in the distance",
        "Dog barking",
        "Car engine starting",
        "Footsteps on gravel",
        "Door creaking open",
        "Waves crashing on beach",
        "Birds chirping in forest",
        "Wind howling",
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Controls */}
            <div className="space-y-6">
                {/* Description Input */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <label className="text-sm text-gray-600 block mb-2">Sound Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the sound effect you want to generate..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-800 min-h-[120px] resize-none"
                    />

                    {/* Preset Ideas */}
                    <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Try these:</p>
                        <div className="flex flex-wrap gap-2">
                            {presets.slice(0, 4).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => setDescription(preset)}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="w-4 h-4 text-gray-800" />
                        <span className="font-medium text-gray-800 text-sm">Settings</span>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-sm text-gray-600 block mb-2">
                            Duration: {duration.toFixed(1)}s
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.5"
                            value={duration}
                            onChange={(e) => setDuration(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Prompt Influence */}
                    <div>
                        <label className="text-sm text-gray-600 block mb-2">
                            Creativity: {(promptInfluence * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={promptInfluence}
                            onChange={(e) => setPromptInfluence(parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Lower = more creative, Higher = closer to description
                        </p>
                    </div>

                    {/* Loop Toggle */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="loop"
                            checked={loop}
                            onChange={(e) => setLoop(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <label htmlFor="loop" className="text-sm text-gray-700">
                            Create looping audio
                        </label>
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !description.trim()}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Sound...
                        </>
                    ) : (
                        <>
                            <Volume2 className="w-4 h-4" />
                            Generate Sound Effect
                        </>
                    )}
                </button>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Right Column - Output */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm min-h-[400px] flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Generated Sound Effect</span>
                        </div>
                        {audioUrl && (
                            <button
                                onClick={downloadAudio}
                                className="p-1.5 bg-gray-50 hover:bg-gray-200 rounded transition-colors text-xs flex items-center gap-1"
                                title="Download"
                            >
                                <Download className="w-3 h-3 text-gray-700" />
                                <span className="text-gray-700">Download</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 bg-gray-100 flex items-center justify-center p-8">
                        {isGenerating ? (
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 mx-auto text-gray-800 animate-spin mb-4" />
                                <p className="text-gray-600 text-sm">Generating sound effect...</p>
                            </div>
                        ) : audioUrl ? (
                            <div className="w-full max-w-md space-y-4">
                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    loop={loop}
                                    className="hidden"
                                />
                                <div className="bg-white rounded-lg p-6 shadow-md">
                                    <div className="flex items-center justify-center mb-4">
                                        <button
                                            onClick={togglePlayPause}
                                            className="w-16 h-16 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center transition-colors"
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-8 h-8 text-white" />
                                            ) : (
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-center text-sm text-gray-600">
                                        Click to {isPlaying ? "pause" : "play"} sound
                                    </p>
                                    {loop && (
                                        <p className="text-center text-xs text-gray-500 mt-2">
                                            🔁 Looping enabled
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-30">
                                <Volume2 className="w-24 h-24 mx-auto text-gray-400 mb-6" />
                                <p className="text-gray-600 text-lg">Ready to Generate</p>
                                <p className="text-gray-400 text-sm mt-2">Your sound effect will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
