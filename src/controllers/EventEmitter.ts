import { EventEmitter } from 'events'

export class TypedEventEmitter<Events extends Record<string, unknown[]>> {
  private readonly emitter = new EventEmitter()

  on<K extends keyof Events>(event: K, listener: (...arg: Events[K]) => void) {
    this.emitter.on(event as string, listener)
    return this
  }

  emit<K extends keyof Events>(event: K, ...arg: Events[K]) {
    this.emitter.emit(event as string, ...arg)
    return this
  }

  off<K extends keyof Events>(event: K, listener: (...arg: Events[K]) => void) {
    this.emitter.off(event as string, listener)
    return this
  }
}