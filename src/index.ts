/**
 * The entrypoint for the action.
 */
import { run, main } from './main'
import { circularReplacer } from './JsonUtils'

export const action_stuff = {
  run,
  main,
  test: 'test'
}

console.log('[process.mainModule]')
console.log(
  JSON.stringify(process.mainModule, circularReplacer(process.mainModule), 2)
)
console.log('')

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()
