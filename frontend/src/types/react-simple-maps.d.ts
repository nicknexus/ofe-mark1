declare module 'react-simple-maps' {
    export interface GeographyProps {
        geography?: any
        fill?: string
        stroke?: string
        style?: {
            default?: React.CSSProperties
            hover?: React.CSSProperties
            pressed?: React.CSSProperties
        }
    }
    
    export interface MarkerProps {
        coordinates?: [number, number]
        children?: React.ReactNode
        onMouseEnter?: () => void
        onMouseLeave?: () => void
        onClick?: () => void
    }
    
    export interface ZoomableGroupProps {
        zoom?: number
        center?: [number, number]
        onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void
        children?: React.ReactNode
    }
    
    export interface GeographiesProps {
        geography?: string
        children?: (props: { geographies: any[] }) => React.ReactNode
    }
    
    export interface ComposableMapProps {
        projectionConfig?: any
        width?: number
        height?: number
        style?: React.CSSProperties
        onClick?: (event: any) => void
        children?: React.ReactNode
    }
    
    export const ComposableMap: React.FC<ComposableMapProps>
    export const Geographies: React.FC<GeographiesProps>
    export const Geography: React.FC<GeographyProps>
    export const Marker: React.FC<MarkerProps>
    export const ZoomableGroup: React.FC<ZoomableGroupProps>
}

