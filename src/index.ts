/**
 * The entrypoint for the action.
 */
import { run, main } from './main'

export const action_stuff = {
  run,
  main,
  test: 'test'
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()
