'use client'

export default function SnapCameraKitPage() {
  return (
    <iframe
      src="https://camerakit-app.vercel.app"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      allow="camera; microphone; accelerometer; gyroscope"
      allowFullScreen
    />
  )
}
