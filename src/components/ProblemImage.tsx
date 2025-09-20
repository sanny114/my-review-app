import React, { useState } from 'react'

interface ProblemImageProps {
  imageUrl?: string
  alt?: string
  maxWidth?: string
  maxHeight?: string
  showZoom?: boolean
}

export const ProblemImage: React.FC<ProblemImageProps> = ({
  imageUrl,
  alt = '問題画像',
  maxWidth = '100%',
  maxHeight = '400px',
  showZoom = true
}) => {
  const [isZoomed, setIsZoomed] = useState(false)

  if (!imageUrl) return null

  const handleImageClick = () => {
    if (showZoom) {
      setIsZoomed(true)
    }
  }

  const handleCloseZoom = () => {
    setIsZoomed(false)
  }

  return (
    <>
      {/* 通常表示 */}
      <div style={{
        marginTop: '12px',
        marginBottom: '12px',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f8f9fa'
      }}>
        <img
          src={imageUrl}
          alt={alt}
          onClick={handleImageClick}
          style={{
            maxWidth,
            maxHeight,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
            cursor: showZoom ? 'zoom-in' : 'default'
          }}
          loading=\"lazy\"
        />
        {showZoom && (
          <div style={{
            padding: '8px',
            backgroundColor: '#e9ecef',
            textAlign: 'center',
            fontSize: '12px',
            color: '#6c757d'
          }}>
            🔍 クリックで拡大表示
          </div>
        )}
      </div>

      {/* 拡大表示モーダル */}
      {isZoomed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'zoom-out'
          }}
          onClick={handleCloseZoom}
        >
          <div style={{
            position: 'relative',
            maxWidth: '95vw',
            maxHeight: '95vh',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <img
              src={imageUrl}
              alt={alt}
              style={{
                maxWidth: '95vw',
                maxHeight: '95vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCloseZoom()
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ProblemImage