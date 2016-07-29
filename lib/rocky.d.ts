declare namespace rocky {
  interface EventBase {
    type?: String // FIXME
    origin?: String // FIXME pebble://SERIAL/APP_UUID
  }

  interface DrawEvent extends EventBase {
    context: RenderingContext
  }

  interface TickEvent extends EventBase {
    date?: Date // FIXME
  }

  type MemoryPressureLevel = "low" | "medium" | "high"

  interface MemoryPressureEvent extends EventBase {
    level: MemoryPressureLevel
  }

  interface MessageEvent {} // FIXME: raw object, should be proper event with .data

  interface Event extends EventBase, DrawEvent, TickEvent, MemoryPressureEvent, MessageEvent { }

  interface RenderingContext extends CanvasRenderingContext2D {
    canvas: Canvas
    measureText(text: string): ExtendedTextMetrics
    curveTo(x: IsNotImplementedInRockyYet, y: number): void
    // curveTo: IsNotImplementedInRockyYet
  }

  interface ExtendedTextMetrics extends TextMetrics {
    height: number
    actualBoundingBoxLeft?: void // FIXME: remove from docs
    actualBoundingBoxRight?: void // FIXME: remove from docs
  }

  interface IsNotImplementedInRockyYet {
    _doesNotWork: any
  }

  /**
   * Blubb
   */
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

  type EventName = "draw" | "message" | "secondchange" | "minutechange" | "hourchange" | "daychange" | "memorypressure"

  interface Rocky {
    // on(eventName: EventName, eventHandler: EventHandler): void
    on(eventName: "minutechange", eventListener: (event: TickEvent) => void): void
    on(eventName: "draw", eventListener: (event: DrawEvent) => void): void
    on(eventName: string, eventListener: (event: Event) => void): void
    postMessage(message: any): void
    requestDraw(): void
    watchInfo?: WatchInfo // Not supported yet
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
