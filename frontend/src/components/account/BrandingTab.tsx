import React, { useEffect, useState } from 'react'
import { Building2, Camera, Save, X } from 'lucide-react'
import { Spinner } from '../ui'
import type { BrandingTabProps } from './accountTypes'

const PRESET_COLORS = [
  { name: 'Nexus Green', value: '#c0dfa1' },
  { name: 'Ocean Blue', value: '#60a5fa' },
  { name: 'Sunset Orange', value: '#fb923c' },
  { name: 'Rose Pink', value: '#f472b6' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Coral', value: '#f87171' },
]

export function BrandingTab({
  organizationName,
  organizationLogo,
  organizationId,
  brandColor,
  uploadingLogo,
  deletingLogo,
  logoInputRef,
  handleLogoUpload,
  handleDeleteLogo,
  onBrandColorChange,
  readOnly = false,
}: BrandingTabProps) {
  const [selectedColor, setSelectedColor] = useState(brandColor || '#c0dfa1')
  const [savingColor, setSavingColor] = useState(false)
  const colorDirty = selectedColor !== brandColor

  useEffect(() => {
    setSelectedColor(brandColor || '#c0dfa1')
  }, [brandColor])

  const handleColorSave = async () => {
    if (!organizationId || !colorDirty) return
    setSavingColor(true)
    try {
      await onBrandColorChange(selectedColor)
    } finally {
      setSavingColor(false)
    }
  }

  return (
    <div className="app-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-800">Brand</h2>
        <p className="text-sm text-secondary-500 mt-0.5">Logo and color on the public page — and later, generated posts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <p className="app-label">Logo</p>
          <div className="flex items-start gap-4">
            <div className="relative group flex-shrink-0">
              <div className="w-28 h-28 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {organizationLogo ? (
                  <img src={organizationLogo} alt={organizationName} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-10 h-10 text-gray-300" />
                )}
              </div>
              {!readOnly && (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingLogo ? <Spinner className="w-6 h-6 border-white border-t-white/30" /> : <Camera className="w-6 h-6 text-white" />}
              </button>
              )}
              {!readOnly && organizationLogo && !uploadingLogo && (
                <button
                  type="button"
                  onClick={handleDeleteLogo}
                  disabled={deletingLogo}
                  className="absolute -top-2 -right-2 w-7 h-7 app-btn app-btn-danger app-btn-icon rounded-full shadow-lg p-0 min-w-0"
                >
                  {deletingLogo ? <Spinner className="w-4 h-4 border-white border-t-white/30" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </div>
            {!readOnly && (
            <div className="min-w-0 pt-1">
              <p className="text-sm text-secondary-600">
                {organizationLogo ? 'Hover to replace.' : 'Square PNG or JPG, at least 200×200, max 5MB.'}
              </p>
            </div>
            )}
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
        </div>

        <div>
          <p className="app-label">Color</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl border border-gray-200 shadow-sm flex-shrink-0" style={{ backgroundColor: selectedColor }} />
            {!readOnly && (
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
            />
            )}
            <input
              type="text"
              value={selectedColor}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setSelectedColor(val)
              }}
              disabled={readOnly}
              className={`app-input w-28 font-mono ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="#c0dfa1"
            />
          </div>
          {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color.value)}
                className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                  selectedColor === color.value ? 'border-gray-800' : 'border-white shadow-sm'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          )}
        </div>
      </div>

      {!readOnly && (
      <div className="flex items-center justify-between pt-5 mt-6 border-t border-gray-100">
        <p className="text-xs text-secondary-500">
          {colorDirty ? 'Unsaved color' : 'Color is saved'}
        </p>
        <button
          type="button"
          onClick={handleColorSave}
          disabled={savingColor || !colorDirty}
          className="app-btn app-btn-primary"
        >
          {savingColor ? <><Spinner className="w-4 h-4 border-white border-t-white/30" />Saving...</> : <><Save className="w-4 h-4" />Save color</>}
        </button>
      </div>
      )}
    </div>
  )
}
