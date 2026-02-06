"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Volume2, FileAudio, UserPlus, Music, Palette, MessageSquare } from "lucide-react";
import { getVoices } from "./actions";
import { TabNavigation } from "./components/TabNavigation";
import { TTSTab } from "./components/TTSTab";
import { SFXTab } from "./components/SFXTab";
import { TranscribeTab } from "./components/TranscribeTab";
import { VoiceCloneTab } from "./components/VoiceCloneTab";
import { MusicTab } from "./components/MusicTab";
import { VoiceDesignTab } from "./components/VoiceDesignTab";
import { DialogueTab } from "./components/DialogueTab";

interface Voice {
    voice_id: string;
    name: string;
    category?: string;
}

const TABS = [
    { id: 'tts', label: 'Text-to-Speech', icon: Mic },
    { id: 'sfx', label: 'Sound Effects', icon: Volume2 },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'design', label: 'Voice Design', icon: Palette },
    { id: 'dialogue', label: 'Text-to-Dialogue', icon: MessageSquare },
    { id: 'transcribe', label: 'Speech-to-Text', icon: FileAudio },
    { id: 'clone', label: 'Voice Clone', icon: UserPlus },
];

export default function AudioStudioPage() {
    const [activeTab, setActiveTab] = useState('tts');
    const [voices, setVoices] = useState<Voice[]>([]);

    // Load voices on mount
    useEffect(() => {
        async function loadVoices() {
            const result = await getVoices();
            if (result.success && result.voices) {
                setVoices(result.voices);
            } else {
                // Fallback to hardcoded voices
                setVoices([
                    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female)" },
                    { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male)" },
                    { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Female)" },
                    { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female)" },
                    { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male)" },
                ]);
            }
        }
        loadVoices();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/tools" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </Link>
                    <h1 className="text-2xl font-bold text-orange-600">ElevenLabs Audio Studio</h1>
                </div>


                {/* Tab Navigation */}
                <TabNavigation
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                {/* Tab Content */}
                {activeTab === 'tts' && <TTSTab voices={voices} />}

                {activeTab === 'sfx' && <SFXTab />}

                {activeTab === 'music' && <MusicTab />}

                {activeTab === 'design' && <VoiceDesignTab />}

                {activeTab === 'dialogue' && <DialogueTab />}

                {activeTab === 'transcribe' && <TranscribeTab />}

                {activeTab === 'clone' && <VoiceCloneTab />}
            </div>
        </div>
    );
}
