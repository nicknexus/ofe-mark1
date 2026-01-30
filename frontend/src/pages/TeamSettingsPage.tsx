import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Redirect to Account Settings with Teams tab
export default function TeamSettingsPage() {
    const navigate = useNavigate()
    
    useEffect(() => {
        navigate('/account?tab=teams', { replace: true })
    }, [navigate])
    
    return null
}
