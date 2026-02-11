"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Loader2, Play, Pause, Plus, Trash2, User } from "lucide-react";
import { generateSpeech, getVoices } from "../actions";

interface Voice {
    voice_id: string;
    name: string;
}

interface DialogueLine {
    id: string;
    speakerId: string; // 'speaker1' or 'speaker2' or custom
    text: string;
    audioUrl?: string;
    isGenerating?: boolean;
}

interface SpeakerMapping {
    id: string;
    name: string; // "Speaker A"
    voiceId: string;
    color: string;
}

export function DialogueTab() {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [script, setScript] = useState<DialogueLine[]>([
        { id: '1', speakerId: 'A', text: 'Hello! How are you doing today?' },
        { id: '2', speakerId: 'B', text: 'I am doing great, thanks for asking! What about you?' },
    ]);

    const [speakers, setSpeakers] = useState<SpeakerMapping[]>([
        { id: 'A', name: 'Speaker A', voiceId: '', color: 'bg-blue-100 text-blue-800 border-blue-200' },
        { id: 'B', name: 'Speaker B', voiceId: '', color: 'bg-green-100 text-green-800 border-green-200' },
    ]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(false); // Track playback state consistently
    const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Load voices
    useEffect(() => {
        async function init() {
            const result = await getVoices();
            let availableVoices: Voice[] = [];

            if (result.success && result.voices && result.voices.length > 0) {
                availableVoices = result.voices;
            } else {
                // Fallback voices if API fails or returns empty
                availableVoices = [
                    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female)" },
                    { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male)" },
                    { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Female)" },
                    { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female)" },
                    { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male)" },
                ];
            }

            setVoices(availableVoices);
            setSpeakers(prev => [
                { ...prev[0], voiceId: availableVoices[0]?.voice_id || '' },
                { ...prev[1], voiceId: availableVoices[1]?.voice_id || '' }
            ]);
        }
        init();
    }, []);

    const addLine = () => {
        const lastSpeaker = script[script.length - 1]?.speakerId;
        const nextSpeaker = lastSpeaker === 'A' ? 'B' : 'A';

        setScript([
            ...script,
            {
                id: Date.now().toString(),
                speakerId: nextSpeaker,
                text: ''
            }
        ]);
    };

    const removeLine = (index: number) => {
        setScript(script.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, updates: Partial<DialogueLine>) => {
        const newScript = [...script];
        newScript[index] = { ...newScript[index], ...updates };
        setScript(newScript);
    };

    const updateSpeakerVoice = (speakerId: string, voiceId: string) => {
        setSpeakers(speakers.map(s =>
            s.id === speakerId ? { ...s, voiceId } : s
        ));
    };

    const generateAll = async () => {
        setIsGenerating(true);

        // Process sequentially to avoid rate limits, or parallel if minimal
        // Let's do parallel batches of 2
        const newScript = [...script];

        for (let i = 0; i < newScript.length; i++) {
            const line = newScript[i];
            if (line.audioUrl) continue; // Skip already generated

            // Mark as generating
            newScript[i] = { ...line, isGenerating: true };
            setScript([...newScript]);

            const speaker = speakers.find(s => s.id === line.speakerId);
            if (!speaker || !line.text.trim()) {
                newScript[i] = { ...line, isGenerating: false };
                continue;
            }

            const result = await generateSpeech(line.text, speaker.voiceId);

            if (result.success && result.audio) {
                newScript[i] = {
                    ...line,
                    audioUrl: `data:${result.mimeType};base64,${result.audio}`,
                    isGenerating: false
                };
            } else {
                newScript[i] = { ...line, isGenerating: false };
            }

            setScript([...newScript]);
        }

        setIsGenerating(false);
    };

    const stopPlayback = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentLineIndex(null);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const playConversation = async () => {
        if (isPlayingRef.current) {
            stopPlayback();
            return;
        }

        isPlayingRef.current = true;
        setIsPlaying(true);

        for (let i = 0; i < script.length; i++) {
            if (!isPlayingRef.current) break; // Check live ref

            const line = script[i];
            if (!line.audioUrl) continue;

            setCurrentLineIndex(i);

            await new Promise<void>((resolve) => {
                if (!audioRef.current || !isPlayingRef.current) return resolve();

                audioRef.current.src = line.audioUrl!;

                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Playback failed", error);
                        resolve();
                    });
                }

                audioRef.current.onended = () => {
                    setTimeout(resolve, 500);
                };
            });
        }

        stopPlayback();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Script & Settings */}
            <div className="lg:col-span-2 space-y-6">
                {/* Speaker Setup */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" /> Speaking Roles
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {speakers.map(speaker => (
                            <div key={speaker.id} className={`p-3 rounded-lg border ${speaker.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-50 ')}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-sm font-bold ${speaker.color.split(' ')[1]}`}>{speaker.name}</span>
                                </div>
                                <select
                                    value={speaker.voiceId}
                                    onChange={(e) => updateSpeakerVoice(speaker.id, e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded text-xs py-1.5 px-2"
                                >
                                    {voices.map(v => (
                                        <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Script Editor */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="space-y-4">
                        {script.map((line, index) => {
                            const speaker = speakers.find(s => s.id === line.speakerId);
                            const isCurrent = currentLineIndex === index;

                            return (
                                <div
                                    key={line.id}
                                    className={`flex gap-3 transition-colors ${isCurrent ? 'bg-orange-50 -mx-2 px-2 py-2 rounded' : ''}`}
                                >
                                    <button
                                        onClick={() => updateLine(index, { speakerId: line.speakerId === 'A' ? 'B' : 'A' })}
                                        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${speaker?.id === 'A' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        title="Switch Speaker"
                                    >
                                        {speaker?.id}
                                    </button>

                                    <div className="flex-1">
                                        <textarea
                                            value={line.text}
                                            onChange={(e) => updateLine(index, { text: e.target.value, audioUrl: undefined })} // Clear audio on edit
                                            placeholder={`What does ${speaker?.name} say?`}
                                            rows={1}
                                            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm focus:border-gray-800 focus:outline-none resize-none overflow-hidden"
                                            style={{ minHeight: '40px', height: 'auto' }}
                                            onInput={(e) => {
                                                (e.target as HTMLTextAreaElement).style.height = 'auto';
                                                (e.target as HTMLTextAreaElement).style.height = (e.target as HTMLTextAreaElement).scrollHeight + 'px';
                                            }}
                                        />
                                        {line.audioUrl && <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Audio Ready</div>}
                                    </div>

                                    <button
                                        onClick={() => removeLine(index)}
                                        className="text-gray-400 hover:text-red-500 self-center"
                                        title="Remove line"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={addLine}
                        className="mt-6 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-800 hover:text-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        < Plus className="w-4 h-4" /> Add Line of Dialogue
                    </button>
                </div>
            </div>

            {/* Right Column - Controls & Output */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm sticky top-6">
                    <h3 className="font-medium text-gray-900 mb-4">Production</h3>

                    <div className="space-y-4">
                        <button
                            onClick={generateAll}
                            disabled={isGenerating || script.every(l => l.audioUrl)}
                            className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating Audio...
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="w-4 h-4" />
                                    {script.some(l => l.audioUrl) ? "Regenerate Missing" : "Generate All Audio"}
                                </>
                            )}
                        </button>

                        <button
                            onClick={playConversation}
                            disabled={isGenerating || !script.some(l => l.audioUrl)}
                            className={`w-full py-3 border rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isPlaying
                                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                : 'bg-orange-50 border-orange-200 text-gray-700 hover:bg-orange-100'
                                }`}
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="w-4 h-4" /> Stop Playback
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" /> Play Conversation
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-6 text-xs text-gray-500 leading-relaxed">
                        <p className="mb-2"><strong>How it works:</strong></p>
                        <p>1. Assign voices to Speaker A and B</p>
                        <p>2. Write the script</p>
                        <p>3. Click "Generate" to create audio for each line</p>
                        <p>4. Click "Play" to listen to the conversation flow</p>
                    </div>
                </div>
            </div>

            {/* Hidden Player */}
            <audio ref={audioRef} className="hidden" />
        </div>
    );
}
