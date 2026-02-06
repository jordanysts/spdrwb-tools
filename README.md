# 🛠️ SPDRWB AI Tools - Standalone Package

A collection of AI-powered creative tools extracted from SPDRWB for easy integration into other Next.js projects.

## 📦 What's Included

### Tools (`/app/tools/`)
| Tool | Path | Description |
|------|------|-------------|
| **AI Image Generator** | `/tools/image-generator` | Generate images with FLUX, SeeDream, Nano Banana |
| **Expression Editor** | `/tools/expression-editor` | Adjust facial expressions with sliders + compositing |
| **AI Image Editor** | `/tools/image` | Iterative editing with Nano Banana Pro |
| **Image Resizer** | `/tools/resizer` | Optimize, convert, resize, compress images |
| **Image Upscaler** | `/tools/upscaler` | Topaz AI upscaling (2x-6x) |
| **AI Video Tool** | `/tools/videogen` | Runway Gen-4 & Google Veo 3 video generation |
| **Audio Generator** | `/tools/audio-gen` | ElevenLabs TTS, SFX, Music, Voice Clone |
| **Audio Editor** | `/tools/audio` | Audio conversion and editing |
| **Snap AR Camera Kit** | `/tools/snap-camerakit` | Snap Camera Kit AR lenses |
| **WebAR Hub** | `/tools/webarhub` | WebAR experiments |
| **Subtropic Photobooth** | `/tools/stspb` | AI photobooth |

### API Routes (`/app/api/tools/`)
- `/api/tools/chat` - Chat endpoint
- `/api/tools/composite` - Image compositing
- `/api/tools/expression-editor` - Expression editing
- `/api/tools/image` - Image processing (Gemini)
- `/api/tools/runway` - Runway video generation
- `/api/tools/tinypng` - Image compression
- `/api/tools/upscaler` - Image upscaling
- `/api/tools/veo` - Google Veo video

### Shared Components (`/components/`)
- `SpiderWebIcon.tsx` - SPDR logo icon
- `tools/ErrorDisplay.tsx` - Error display with copy-to-clipboard

### Utilities (`/lib/`)
- `image-compression.ts` - Client-side image compression

### Public Assets (`/public/`)
- `frog-rolling.gif` - Loading indicator
- `jordanyspin.gif` - Footer branding

---

## 🚀 Integration Guide

### 1. Copy Files to Your Project

```bash
# Copy tools to your Next.js project
cp -r app/tools/* YOUR_PROJECT/app/tools/
cp -r app/api/tools/* YOUR_PROJECT/app/api/tools/
cp -r components/* YOUR_PROJECT/components/
cp -r lib/* YOUR_PROJECT/lib/
cp -r public/* YOUR_PROJECT/public/
```

### 2. Install Dependencies

```bash
npm install @google/genai @google/generative-ai @runwayml/sdk replicate react-compare-slider react-dropzone react-easy-crop framer-motion lucide-react
```

### 3. Configure Environment Variables

Add these to your `.env.local`:

```env
# AI Models
GOOGLE_GENAI_API_KEY=your_google_ai_key
REPLICATE_API_TOKEN=your_replicate_token
RUNWAY_API_KEY=your_runway_key

# ElevenLabs (for audio)
ELEVENLABS_API_KEY=your_elevenlabs_key

# TinyPNG (for image compression)
TINYPNG_API_KEY=your_tinypng_key

# Snap Camera Kit (for AR)
SNAP_CAMERA_KIT_API_TOKEN=your_snap_token
SNAP_LENS_GROUP_ID=your_lens_group_id
```

### 4. Update Import Paths (if needed)

The tools use `@/` path aliases. Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 5. Add Navigation Link

Add a link to your main navigation:

```tsx
<Link href="/tools">AI Tools</Link>
```

---

## 🎨 Customization

### Theming
The tools use an orange accent (`#f97316`). To customize:
- Search for `text-orange-` and `bg-orange-` classes
- Replace with your brand color

### Branding
- Replace `/public/jordanyspin.gif` with your logo
- Update `SpiderWebIcon.tsx` with your icon

### Remove Unused Tools
Delete any tool folders you don't need from both:
- `/app/tools/[tool-name]/`
- `/app/api/tools/[tool-name]/`

Then update `/app/tools/page.tsx` to remove from the `toolSections` array.

---

## 📋 Required npm Packages

```json
{
  "dependencies": {
    "@google/genai": "^1.38.0",
    "@google/generative-ai": "^0.21.0",
    "@runwayml/sdk": "^3.11.0",
    "@snap/camera-kit": "^1.13.0",
    "framer-motion": "^11.13.1",
    "lucide-react": "^0.468.0",
    "react-compare-slider": "^3.1.0",
    "react-dropzone": "^14.3.5",
    "react-easy-crop": "^5.5.6",
    "replicate": "^1.4.0"
  }
}
```

---

## 📁 File Structure

```
spdrwb-tools-export/
├── app/
│   ├── tools/
│   │   ├── page.tsx              # Tools hub/index page
│   │   ├── actions.ts            # Shared actions
│   │   ├── audio/
│   │   ├── audio-gen/
│   │   ├── camera-kit/
│   │   ├── expression-editor/
│   │   ├── image/
│   │   ├── image-generator/
│   │   ├── resizer/
│   │   ├── snap-camerakit/
│   │   ├── stspb/
│   │   ├── upscaler/
│   │   ├── video/
│   │   ├── videogen/
│   │   └── webarhub/
│   └── api/tools/
│       ├── chat/
│       ├── composite/
│       ├── expression-editor/
│       ├── image/
│       ├── runway/
│       ├── tinypng/
│       ├── upscaler/
│       └── veo/
├── components/
│   ├── SpiderWebIcon.tsx
│   └── tools/
│       └── ErrorDisplay.tsx
├── lib/
│   └── image-compression.ts
├── public/
│   ├── frog-rolling.gif
│   └── jordanyspin.gif
└── README.md
```

---

Built with 🕸️ by SPDR Studio
