export function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    )
}

export type MobilePlatform =
    | 'ios-safari'
    | 'ios-other'
    | 'android-chrome'
    | 'android-other'
    | 'other'

export function getMobilePlatform(): MobilePlatform {
    const ua = navigator.userAgent

    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/i.test(ua)

    if (isIOS) {
        const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)
        return isSafari ? 'ios-safari' : 'ios-other'
    }

    if (isAndroid) {
        const isChrome = /Chrome/i.test(ua) && !/OPR|Edge|Edg/i.test(ua)
        return isChrome ? 'android-chrome' : 'android-other'
    }

    return 'other'
}

export function isMobileDevice(): boolean {
    return /Mobi|Android/i.test(navigator.userAgent)
}

export function getDeferredInstallPrompt(): any {
    return (window as any).deferredInstallPrompt
}
