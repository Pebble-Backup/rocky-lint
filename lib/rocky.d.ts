declare namespace rocky {
  interface IsNotImplementedInRockyYet {
    _doesNotWork: any
  }

  interface EventBase {
    type: IsNotImplementedInRockyYet // FIXME: string
    origin: IsNotImplementedInRockyYet // FIXME: string, pebble://SERIAL/APP_UUID
  }

  interface DrawEvent extends EventBase {
    context: RenderingContext
  }

  interface TickEvent extends EventBase {
    date: IsNotImplementedInRockyYet // FIXME Date
  }

  type MemoryPressureLevel = "low" | "medium" | "high"

  interface MemoryPressureEvent extends EventBase {
    level: MemoryPressureLevel
  }

  interface Event extends EventBase, DrawEvent, TickEvent, MemoryPressureEvent { }

  interface RenderingContext extends CanvasRenderingContext2D {
    canvas: Canvas
    measureText(text: string): ExtendedTextMetrics
    curveTo(x: IsNotImplementedInRockyYet, y: number): void
  }

  interface ExtendedTextMetrics extends TextMetrics {
    height: number
    actualBoundingBoxLeft?: void // FIXME: remove from docs
    actualBoundingBoxRight?: void // FIXME: remove from docs
  }

  interface Canvas extends HTMLCanvasElement {
    unobstructedWidth: number
    unobstructedHeight: number
    unobstructedTop: number
    unobstructedLeft: number
  }

  interface WatchInfo {
    color: { id: number, name: string }
    model: { id: number, name: string }
    version: { major: number, minor: number, patch: number } // FIXME: is patch a string?
  }

  interface EventHandler { (event: Event): void }

  interface Rocky {
    on(eventName: "draw", eventListener: (event: DrawEvent) => void): void
    on(eventName: "message", messageListener: (message: any) => void): void // FIXME: proper event with .data
    on(eventName: "hourchange", eventListener: (event: TickEvent) => void): void
    on(eventName: "minutechange", eventListener: (event: TickEvent) => void): void
    on(eventName: "secondchange", eventListener: (event: TickEvent) => void): void
    on(eventName: "daychange", eventListener: (event: TickEvent) => void): void
    on(eventName: "memorypressure", eventListener: (event: MemoryPressureEvent) => void): void
    on(eventName: string, eventListener: (event: Event) => void): void
    postMessage(message: any): void
    requestDraw(): void
    watchInfo: IsNotImplementedInRockyYet // FIXME: WatchInfo
  }
}

declare module 'rocky' {
    var rocky: rocky.Rocky
    export = rocky
}

declare var _rocky: rocky.Rocky

interface Require {
  (moduleName: 'rocky'): rocky.Rocky
  (moduleName: string): any
}

declare var require: Require
