/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main0 from '../src/main'
import { config0 } from '../src/main'
import { IMainConfig } from '../src/zenhub_reports/src/zenhub_call'
import * as path from 'node:path'

class MockMain {
  private readonly _conf: IMainConfig
  get conf(): IMainConfig {
    return this._conf
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly _obj: any) {
    this._conf = Object.assign({}, config0)
    const minDate = new Date(this._conf.minDate as string)
    minDate.setDate(minDate.getDate() + 1)
    this._conf.inputJsonFilename = path.join(
      __dirname,
      'resources',
      'workspace_a74ef40adbe1806e2d9d5d00b209e801.json'
    )
    this._conf.maxDate = new Date(minDate.toISOString()).toISOString()

    // const content = fs.readFileSync(this._conf.inputJsonFilename, { encoding: "utf8" });
    // const obj = JSON.parse(content);
    // obj.pipelinesConnection = [];
    // fs.writeFileSync(this._conf.inputJsonFilename, JSON.stringify(obj, null, 2), { encoding: "utf8" })
    // debugger
  }

  async run(conf?: IMainConfig): Promise<object> {
    return this._obj.run(conf || this._conf)
  }
}

// Mock the action's main function
const main = new MockMain(main0)

const runMock = jest.spyOn(main, 'run')

// Other utilities
// const timeRegex = /^\d{2}:\d{2}:\d{2}/

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
// let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    // getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('sets the time output', async () => {
    // Set the action's inputs as return values from core.getInput()
    // getInputMock.mockImplementation(name => {
    //   switch (name) {
    //     case 'milliseconds':
    //       return '500'
    //     default:
    //       return ''
    //   }
    // })

    const myFile = main.conf.inputJsonFilename

    // eslint-disable-next-line github/no-then
    const hsaErr = await main.run().then(
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

  it('sets a failed status', async () => {
    const badConf = main.conf
    badConf.workspaceId += 'P'

    const hsaErr: boolean = await main.run(badConf).then(
      () => false,
      () => {
        return true
      }
    )
    expect(hsaErr).toBeFalsy()

    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Bad workspace ID')
    expect(errorMock).not.toHaveBeenCalled()
  })
})
