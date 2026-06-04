import React, { useState } from 'react'
import {
 Building2,
 Camera,
 Palette,
 Save,
 X,
} from 'lucide-react'
import { Spinner } from '../ui'
import type { BrandingTabProps } from './accountTypes'

export function BrandingTab({ organizationName, organizationLogo, organizationId, brandColor, uploadingLogo, deletingLogo, logoInputRef, handleLogoUpload, handleDeleteLogo, onBrandColorChange }: BrandingTabProps) {
 const [selectedColor, setSelectedColor] = useState(brandColor || '#c0dfa1')
 const [savingColor, setSavingColor] = useState(false)

 const presetColors = [
 { name: 'Nexus Green', value: '#c0dfa1' },
 { name: 'Ocean Blue', value: '#60a5fa' },
 { name: 'Sunset Orange', value: '#fb923c' },
 { name: 'Rose Pink', value: '#f472b6' },
 { name: 'Purple', value: '#a78bfa' },
 { name: 'Teal', value: '#2dd4bf' },
 { name: 'Amber', value: '#fbbf24' },
 { name: 'Coral', value: '#f87171' },
 ]

 const handleColorSave = async () => {
 if (!organizationId || selectedColor === brandColor) return
 setSavingColor(true)
 try {
 await onBrandColorChange(selectedColor)
 } finally {
 setSavingColor(false)
 }
 }

 return (
 <div className="space-y-6">
 {/* Logo Section */}
 <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-6">
 <div className="p-2 bg-primary-50 rounded-xl"><Camera className="w-5 h-5 text-primary-600" /></div>
 <h2 className="text-lg font-semibold text-gray-800">Organization Logo</h2>
 </div>

 <div className="flex items-start gap-8">
 {/* Logo Upload */}
 <div className="flex flex-col items-center">
 <div className="relative group">
 <div className="w-32 h-32 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-primary-400 transition-colors">
 {organizationLogo ? (
 <img src={organizationLogo} alt={organizationName} className="w-full h-full object-cover" />
 ) : (
 <Building2 className="w-12 h-12 text-gray-400" />
 )}
 </div>

 <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
 className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
 {uploadingLogo ? <Spinner className="w-8 h-8 border-white border-t-white/30" /> : <Camera className="w-8 h-8 text-white" />}
 </button>

 {organizationLogo && !uploadingLogo && (
 <button onClick={handleDeleteLogo} disabled={deletingLogo}
className="absolute -top-2 -right-2 w-7 h-7 app-btn app-btn-danger app-btn-icon rounded-full shadow-lg p-0 min-w-0">
{deletingLogo ? <Spinner className="w-4 h-4 border-white border-t-white/30" /> : <X className="w-4 h-4" />}
 </button>
 )}
 </div>
 <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
 <p className="text-sm text-gray-500 mt-3">{organizationLogo ? 'Click to change' : 'Upload logo'}</p>
 </div>

 {/* Info */}
 <div className="flex-1">
 <h3 className="text-lg font-medium text-gray-900 mb-2">{organizationName}</h3>
 <p className="text-sm text-gray-600 mb-4">
 Your organization logo appears on your public dashboard and when others search for your organization on the Explore page.
 </p>
 <div className="p-4 bg-gray-50 rounded-xl">
 <p className="text-sm text-gray-600 font-medium mb-2">Guidelines:</p>
 <ul className="text-sm text-gray-500 space-y-1">
 <li>• Square image recommended (1:1 ratio)</li>
 <li>• Minimum 200x200 pixels</li>
 <li>• PNG or JPG format</li>
 <li>• Max file size: 5MB</li>
 </ul>
 </div>
 </div>
 </div>
 </div>

 {/* Brand Color Section */}
 <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-6">
 <div className="p-2 bg-primary-50 rounded-xl"><Palette className="w-5 h-5 text-primary-600" /></div>
 <h2 className="text-lg font-semibold text-gray-800">Brand Color</h2>
 </div>

 <p className="text-sm text-gray-600 mb-5">
 Choose a brand color for your public pages. This will be used as the accent color throughout your public dashboard and initiative pages.
 </p>

 {/* Color Preview */}
 <div className="mb-6 p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${selectedColor}20, ${selectedColor}10)` }}>
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 rounded-xl shadow-lg" style={{ backgroundColor: selectedColor }} />
 <div>
 <p className="text-sm font-medium text-gray-900">Preview</p>
 <p className="text-xs text-gray-500 font-mono">{selectedColor.toUpperCase()}</p>
 </div>
 </div>
 </div>

 {/* Preset Colors */}
 <div className="mb-6">
 <p className="text-sm font-medium text-gray-700 mb-3">Preset Colors</p>
 <div className="flex flex-wrap gap-2">
 {presetColors.map((color) => (
 <button
 key={color.value}
 onClick={() => setSelectedColor(color.value)}
 className={`w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 ${selectedColor === color.value ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-white shadow-md'
 }`}
 style={{ backgroundColor: color.value }}
 title={color.name}
 />
 ))}
 </div>
 </div>

 {/* Custom Color Picker */}
 <div className="mb-6">
 <p className="text-sm font-medium text-gray-700 mb-3">Custom Color</p>
 <div className="flex items-center gap-3">
 <input
 type="color"
 value={selectedColor}
 onChange={(e) => setSelectedColor(e.target.value)}
 className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0"
 />
 <input
 type="text"
 value={selectedColor}
 onChange={(e) => {
 const val = e.target.value
 if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setSelectedColor(val)
 }}
 className="app-input w-28 font-mono"
 placeholder="#c0dfa1"
 />
 </div>
 </div>

 {/* Save Button */}
 <div className="flex items-center justify-between pt-4 border-t border-gray-100">
 <p className="text-xs text-gray-500">
 {selectedColor !== brandColor ? 'You have unsaved changes' : 'Color is saved'}
 </p>
 <button
 onClick={handleColorSave}
 disabled={savingColor || selectedColor === brandColor}
 className="app-btn app-btn-primary flex items-center gap-2"
 >
 {savingColor ? (
 <><Spinner className="w-4 h-4 border-white border-t-white/30" />Saving...</>
 ) : (
 <><Save className="w-4 h-4" />Save Color</>
 )}
 </button>
 </div>
 </div>
 </div>
 )
}
