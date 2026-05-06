import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const imageData = readFileSync(join(process.cwd(), 'public', 'golf-icon.png'))
  const dataUrl = `data:image/png;base64,${imageData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f2540',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '20%',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          width="76%"
          height="76%"
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  )
}
