import React, { useState, useRef } from 'react'

interface ImageUploaderProps {
  currentImageUrl?: string
  onImageChange: (file: File | null) => void
  onImageDelete?: () => void
  maxSizeMB?: number
  disabled?: boolean
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImageUrl,
  onImageChange,
  onImageDelete,
  maxSizeMB = 2,
  disabled = false
}) => {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    // ファイルサイズチェック
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      alert(`ファイルサイズが${maxSizeMB}MBを超えています。`)
      return false
    }

    // ファイル形式チェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('JPEG、PNG、GIF、WebP形式の画像ファイルを選択してください。')
      return false
    }

    return true
  }

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return

    // プレビュー生成
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // 親コンポーネントに通知
    onImageChange(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDelete = () => {
    setPreview(null)
    onImageChange(null)
    if (onImageDelete) {
      onImageDelete()
    }
    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
        📷 問題文の画像（任意）
      </label>
      
      {preview ? (
        // 画像プレビュー表示
        <div style={{
          border: '2px solid #dee2e6',
          borderRadius: '8px',
          padding: '12px',
          backgroundColor: '#f8f9fa'
        }}>
          <img
            src={preview}
            alt="問題画像プレビュー"
            style={{
              maxWidth: '100%',
              maxHeight: '300px',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto 12px'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              className="button secondary"
              onClick={handleClick}
              disabled={disabled}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              📷 画像変更
            </button>
            <button
              type="button"
              className="button"
              onClick={handleDelete}
              disabled={disabled}
              style={{ 
                fontSize: '13px', 
                padding: '6px 12px',
                backgroundColor: '#dc3545',
                borderColor: '#dc3545'
              }}
            >
              🗑️削除
            </button>
          </div>
        </div>
      ) : (
        // アップロードエリア
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${dragOver ? '#007bff' : '#dee2e6'}`,
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: dragOver ? '#f0f8ff' : disabled ? '#f8f9fa' : 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: disabled ? '#6c757d' : '#495057'
          }}>
            {dragOver ? '画像をドロップしてください' : 'クリックまたはドラッグ&ドロップで画像を追加'}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>
            JPEG、PNG、GIF、WebP形式（最大{maxSizeMB}MB）
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileInput}
        disabled={disabled}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default ImageUploader