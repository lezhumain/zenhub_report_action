/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as path from 'node:path'
import { main, run } from '../src/main'
import { IMainConfig } from '../src/zenhub_reports/src/main_conf'

class MockMain {
  private _conf?: IMainConfig
  get conf(): IMainConfig | undefined {
    return this._conf
  }

  static getTestConf(conf0: IMainConfig): IMainConfig {
    const cconf = Object.assign({}, conf0)
    const minDate = new Date(cconf.minDate as string)
    minDate.setDate(minDate.getDate() + 1)
    cconf.inputJsonFilename = path.join(
      __dirname,
      'resources',
      'workspace_a74ef40adbe1806e2d9d5d00b209e801.json'
    )
    cconf.maxDate = new Date(minDate.toISOString()).toISOString()
    return cconf
  }
}

const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('works with empty pipeline list', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'WORKSPACE_ID':
          return '5e3018c2d1'
        case 'REPO_ID':
          return '500'
        case 'FROM_PIPELINE':
          return 'My from'
        case 'TO_PIPELINE':
          return 'My to'
        case 'FROM_DATE':
          return ''
        case 'TO_DATE':
          return ''
        default:
          return ''
      }
    })

    main.init()

    expect(getInputMock).toHaveBeenNthCalledWith(4, 'WORKSPACE_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(3, 'REPO_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(2, 'FROM_DATE')
    expect(getInputMock).toHaveBeenNthCalledWith(1, 'TO_DATE')

    const newConf: IMainConfig = MockMain.getTestConf(
      main.config0 as IMainConfig
    )
    Object.assign(main.config0!, newConf)
    const myFile: string | undefined = main.config0!.inputJsonFilename

    // eslint-disable-next-line github/no-then
    const hsaErr = await run().then(
      () => false,
      () => {
        return true
      }
    )
    expect(hsaErr).toBeFalsy()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(1, `Got file ${myFile}`)

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'markdownContent',
      expect.stringMatching(/.+/)
    )
    expect(errorMock).not.toHaveBeenCalled()
  }, 10000)

  it('works with multiple repo ids', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'WORKSPACE_ID':
          return '5e3018c2d1'
        case 'REPO_ID':
          return '500,501'
        case 'FROM_PIPELINE':
          return 'My from'
        case 'TO_PIPELINE':
          return 'My to'
        case 'FROM_DATE':
          return ''
        case 'TO_DATE':
          return ''
        default:
          return ''
      }
    })

    main.init()

    expect(getInputMock).toHaveBeenNthCalledWith(4, 'WORKSPACE_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(3, 'REPO_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(2, 'FROM_DATE')
    expect(getInputMock).toHaveBeenNthCalledWith(1, 'TO_DATE')

    const newConf: IMainConfig = MockMain.getTestConf(
      main.config0 as IMainConfig
    )
    Object.assign(main.config0!, newConf)
    const myFile: string | undefined = main.config0!.inputJsonFilename

    // eslint-disable-next-line github/no-then
    const hsaErr = await run().then(
      () => false,
      () => {
        return true
      }
    )
    expect(hsaErr).toBeFalsy()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(1, `Got file ${myFile}`)

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'markdownContent',
      expect.stringMatching(/.+/)
    )
    expect(errorMock).not.toHaveBeenCalled()

    expect(JSON.stringify(main.config0?.includeRepos)).toEqual(
      JSON.stringify([500, 501])
    )
    expect(JSON.stringify(newConf.includeRepos)).toEqual(
      JSON.stringify([500, 501])
    )
  }, 10000)

  it('bad workspace id', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'WORKSPACE_ID':
          return '5e3018c2d1Z'
        case 'REPO_ID':
          return '500'
        case 'FROM_PIPELINE':
          return 'My from'
        case 'TO_PIPELINE':
          return 'My to'
        case 'FROM_DATE':
          return ''
        case 'TO_DATE':
          return ''
        default:
          return ''
      }
    })

    main.init()

    expect(getInputMock).toHaveBeenNthCalledWith(4, 'WORKSPACE_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(3, 'REPO_ID')

    // eslint-disable-next-line github/no-then
    const hsaErr = await run().then(
      () => false,
      () => {
        return true
      }
    )
    expect(hsaErr).toBeFalsy()
    expect(runMock).toHaveReturned()

    // Verify that all the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Bad workspace ID')
    expect(errorMock).not.toHaveBeenCalled()
  }, 10000)

  it('missing workspace id', async () => {
    // Set the action's inputs as return values from core.getInput()
    const WORKSPACE_ID = ''
    const REPO_ID = '500'
    const FROM_PIPELINE = 'My from'
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'WORKSPACE_ID':
          return WORKSPACE_ID
        case 'REPO_ID':
          return REPO_ID
        case 'FROM_PIPELINE':
          return FROM_PIPELINE
        case 'TO_PIPELINE':
          return 'My to'
        case 'FROM_DATE':
          return ''
        case 'TO_DATE':
          return ''
        default:
          return ''
      }
    })

    // const newConf: IMainConfig = MockMain.getTestConf(
    //   main.config0 as IMainConfig
    // )
    // const m = main.config0
    // Object.assign(main.config0!, newConf)
    if (main.config0) {
      delete main.config0.inputJsonFilename
    }

    // eslint-disable-next-line github/no-then
    const hsaErr = await run().then(
      () => false,
      () => {
        return true
      }
    )

    expect(getInputMock).toHaveBeenNthCalledWith(4, 'WORKSPACE_ID')
    expect(getInputMock).toHaveBeenNthCalledWith(3, 'REPO_ID')

    expect(hsaErr).toBeFalsy()
    expect(runMock).toHaveReturned()

    // Verify that all the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      `Need to export WORKSPACE_ID (${WORKSPACE_ID}) and REPO_ID (${REPO_ID}) (${FROM_PIPELINE})`
    )
    expect(errorMock).not.toHaveBeenCalled()
  }, 10000)
})
