import React, { useEffect, useRef, useState } from 'react'
import { Palette, Save, Loader2, Camera, Building2, X } from 'lucide-react'
import StepHeader from '../StepHeader'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'

interface Props {
  orgId: string | null
  orgName?: string
}

// Match the account settings Branding tab exactly.
const DEFAULT_COLOR = '#c0dfa1'
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

/**
 * Account-setup step: logo (left) + brand color with a live public-page preview
 * (right). Everything is optional and persists directly to the organization, so
 * the dashboard picks it up via the onboarding-updated refresh on finish.
 */
export default function BrandingStep({ orgId, orgName }: Props) {
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR)
  const [savedColor, setSavedColor] = useState(DEFAULT_COLOR)
  const [savingColor, setSavingColor] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!orgId) return
    let active = true
    apiService.getOrganization(orgId)
      .then(org => {
        if (!active) return
        if (org.brand_color) { setSelectedColor(org.brand_color); setSavedColor(org.brand_color) }
        if (org.logo_url) setLogoUrl(org.logo_url)
      })
      .catch(() => { /* non-fatal — start with defaults */ })
    return () => { active = false }
  }, [orgId])

  const handleColorSave = async () => {
    if (!orgId || selectedColor === savedColor) return
    setSavingColor(true)
    try {
      await apiService.updateOrganization(orgId, { brand_color: selectedColor })
      setSavedColor(selectedColor)
      notify.success('Brand color saved')
    } catch (e) {
      notify.error((e as Error).message || 'Could not save color')
    } finally {
      setSavingColor(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || !orgId) return
    if (!file.type.startsWith('image/')) { notify.error('Please choose an image file'); return }
    setUploading(true)
    try {
      const res = await apiService.uploadOrganizationLogo(orgId, file)
      setLogoUrl(res.logo_url)
      notify.success('Logo uploaded')
    } catch (e) {
      notify.error((e as Error).message || 'Could not upload logo')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeLogo = async () => {
    if (!orgId) return
    try {
      await apiService.deleteOrganizationLogo(orgId)
      setLogoUrl(undefined)
      notify.success('Logo removed')
    } catch (e) {
      notify.error((e as Error).message || 'Could not remove logo')
    }
  }

  return (
    <div>
      <StepHeader
        icon={Palette}
        title="Make it yours"
        subtitle="Branding"
        pill="Optional"
        description="Add your logo and brand color — see how your public page looks as you go. Skip and set these later from Account settings anytime."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* LEFT — Logo square (mirrors Account → Branding) */}
        <div className="app-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-50 rounded-xl"><Camera className="w-5 h-5 text-primary-600" /></div>
            <h2 className="text-lg font-semibold text-gray-800">Organization Logo</h2>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-primary-400 transition-colors">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-12 h-12 text-gray-400" />
                )}
              </div>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
              </button>

              {logoUrl && !uploading && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 w-7 h-7 app-btn app-btn-danger app-btn-icon rounded-full shadow-lg p-0 min-w-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-3">{logoUrl ? 'Click to change' : 'Upload logo'}</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl mt-6">
            <p className="text-sm text-gray-600 font-medium mb-2">Guidelines:</p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Square image recommended (1:1 ratio)</li>
              <li>• Minimum 200x200 pixels</li>
              <li>• PNG or JPG format</li>
              <li>• Max file size: 5MB</li>
            </ul>
          </div>
        </div>

        {/* RIGHT — Brand color picker + live preview */}
        <div className="space-y-6">
          <div className="app-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-50 rounded-xl"><Palette className="w-5 h-5 text-primary-600" /></div>
              <h2 className="text-lg font-semibold text-gray-800">Brand Color</h2>
            </div>

            {/* Preset Colors */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-3">Preset Colors</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
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
            <div className="mb-5">
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
                {selectedColor !== savedColor ? 'You have unsaved changes' : 'Color is saved'}
              </p>
              <button
                onClick={handleColorSave}
                disabled={savingColor || selectedColor === savedColor}
                className="app-btn app-btn-primary flex items-center gap-2"
              >
                {savingColor ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4" />Save Color</>
                )}
              </button>
            </div>
          </div>

          {/* Live public-page preview */}
          <PublicPagePreview color={selectedColor} logoUrl={logoUrl} orgName={orgName} />
        </div>
      </div>
    </div>
  )
}

/**
 * Lightweight, recolorable graphic that evokes the public organization page —
 * not pixel-accurate, just enough to preview how the brand color reads.
 */
function PublicPagePreview({ color, logoUrl, orgName }: { color: string; logoUrl?: string; orgName?: string }) {
  const tint = (pct: string) => `${color}${pct}` // color + alpha hex
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2 px-1">Public page preview</p>
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-card bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="ml-2 h-3.5 flex-1 rounded-full bg-white/80 border border-gray-200" />
        </div>

        {/* Page */}
        <div className="p-4" style={{ background: `linear-gradient(180deg, ${tint('1f')} 0%, #ffffff 55%)` }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow ring-1 ring-black/5 flex items-center justify-center flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-5 h-5" style={{ color }} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{orgName || 'Your Organization'}</div>
                <div className="h-1.5 w-20 rounded-full bg-gray-200 mt-1" />
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-[10px] font-semibold text-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }}>
              Donate
            </span>
          </div>

          {/* Hero band */}
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: tint('24') }}>
            <div className="h-2.5 w-28 rounded-full" style={{ backgroundColor: color }} />
            <div className="h-1.5 w-40 max-w-full rounded-full bg-gray-300/70 mt-2" />
            <div className="h-1.5 w-32 max-w-full rounded-full bg-gray-300/50 mt-1.5" />
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {['1.2k', '38', '6'].map((n, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
                <div className="text-sm font-bold leading-none" style={{ color }}>{n}</div>
                <div className="h-1 w-8 rounded-full bg-gray-200 mt-1.5" />
              </div>
            ))}
          </div>

          {/* Initiative cards */}
          <div className="space-y-2">
            {[0, 1].map(i => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
                <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1">
                  <div className="h-1.5 w-24 rounded-full bg-gray-300/80" />
                  <div className="h-1.5 w-32 max-w-full rounded-full bg-gray-200 mt-1.5" />
                </div>
                <span className="text-[10px] font-medium" style={{ color }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
