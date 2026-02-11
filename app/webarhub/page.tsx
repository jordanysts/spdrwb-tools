'use client'

export default function WebARHubPage() {
  return (
    <iframe
      src="https://ar-test-sable-seven.vercel.app"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking"
      allowFullScreen
    />
  )
}
