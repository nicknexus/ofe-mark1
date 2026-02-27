import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        setLoading(true)
        try {
            await AuthService.updatePassword(password)
            toast.success('Password updated successfully!')
            navigate('/')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update password')
        } finally {
            setLoading(false)
        }
    }

    const brandColor = '#c0dfa1'

    return (
        <div className="min-h-screen font-figtree relative">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            <div className="relative z-10 flex items-center justify-center px-4 py-8 min-h-screen">
                <div className="max-w-md w-full space-y-6 sm:space-y-8">
                    <div className="text-center">
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
                            Set New Password
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground px-2">
                            Enter your new password below
                        </p>
                    </div>

                    <div className="glass-card p-6 sm:p-8 space-y-4 sm:space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-white/80 text-sm"
                                    placeholder="Enter new password"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-white/80 text-sm"
                                    placeholder="Confirm new password"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary-500 text-gray-800 py-2.5 px-4 rounded-xl hover:bg-primary-600 focus:ring-2 focus:ring-primary-500/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
