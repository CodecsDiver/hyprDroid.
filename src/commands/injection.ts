import type { InjectionKey } from 'vue'
import type { AppCommand } from './commandRegistry'

export const APP_COMMANDS_KEY: InjectionKey<AppCommand[]> = Symbol('appCommands')
