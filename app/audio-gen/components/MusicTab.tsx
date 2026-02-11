"use client";

import { useState, useRef } from "react";
import { Music, Loader2, Download, Play, Pause, Disc } from "lucide-react";
import { generateMusic } from "../actions";

export function MusicTab() {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a music description");
            return;
        }

        setIsGenerating(true);
        setError("");
        setAudioUrl(null);

        const result = await generateMusic(prompt, duration);

        if (result.success && result.audio) {
            const audioBlob = `data:${result.mimeType};base64,${result.audio}`;
            setAudioUrl(audioBlob);
        } else {
            setError(result.error || "Failed to generate music");
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
        link.download = `music-${Date.now()}.mp3`;
        link.click();
    };

    const styles = [
        "Lo-fi hip hop beat, chill, study music",
        "Epic cinematic orchestral, hans zimmer style",
        "Upbeat pop track, summer vibes, energetic",
        "Dark synthwave, cyberpunk, neon lights",
        "Acoustic guitar and piano, melancholic",
        "Techno, thumping bass, club atmosphere",
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Controls */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <label className="text-sm text-gray-600 block mb-2">Music Description</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the music you want to create (genre, mood, instruments)..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-800 min-h-[120px] resize-none"
                    />

                    <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Try these styles:</p>
                        <div className="flex flex-wrap gap-2">
                            {styles.slice(0, 4).map((style) => (
                                <button
                                    key={style}
                                    onClick={() => setPrompt(style)}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors truncate max-w-[200px]"
                                    title={style}
                                >
                                    {style.split(",")[0]}...
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Disc className="w-4 h-4 text-gray-800" />
                        <span className="font-medium text-gray-800 text-sm">Settings</span>
                    </div>

                    <div>
                        <label className="text-sm text-gray-600 block mb-2">
                            Duration: {duration} seconds
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="30"
                            step="1"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            className="w-full accent-gray-900"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>5s</span>
                            <span>15s</span>
                            <span>30s</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Composing...
                        </>
                    ) : (
                        <>
                            <Music className="w-4 h-4" />
                            Generate Music
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
                            <Music className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Generated Track</span>
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
                                <p className="text-gray-600 text-sm">Composing your track...</p>
                                <p className="text-xs text-gray-400 mt-2">This may take 10-20 seconds</p>
                            </div>
                        ) : audioUrl ? (
                            <div className="w-full max-w-md space-y-4">
                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    className="hidden"
                                />

                                {/* Vinyl Record Animation */}
                                <div className="relative w-48 h-48 mx-auto mb-6">
                                    <div className={`w-full h-full rounded-full bg-gray-900 flex items-center justify-center shadow-xl border-4 border-gray-800 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                                        <div className="w-1/3 h-1/3 rounded-full bg-gray-800 flex items-center justify-center border-4 border-gray-900">
                                            <div className="w-2 h-2 rounded-full bg-white"></div>
                                        </div>
                                        {/* Grooves */}
                                        <div className="absolute inset-0 rounded-full border border-gray-800 opacity-50 scale-90"></div>
                                        <div className="absolute inset-0 rounded-full border border-gray-800 opacity-50 scale-75"></div>
                                        <div className="absolute inset-0 rounded-full border border-gray-800 opacity-50 scale-60"></div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg p-6 shadow-md">
                                    <div className="flex items-center justify-center mb-4">
                                        <button
                                            onClick={togglePlayPause}
                                            className="w-16 h-16 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center transition-colors shadow-lg"
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-8 h-8 text-white" />
                                            ) : (
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-center text-sm text-gray-600">
                                        Click to {isPlaying ? "pause" : "play"} track
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-30">
                                <Music className="w-24 h-24 mx-auto text-gray-400 mb-6" />
                                <p className="text-gray-600 text-lg">Ready to Compose</p>
                                <p className="text-gray-400 text-sm mt-2">Describe the music you want to hear</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
