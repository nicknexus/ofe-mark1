export default function PWALoadingScreen() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB]">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mb-6 shadow-lg">
                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
            </div>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
    )
}
