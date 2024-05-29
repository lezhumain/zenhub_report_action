import * as core from '@actions/core'
import {
  IMainConfig,
  IProgramResult,
  Program
} from './zenhub_reports/src/zenhub_call'
import { IGhEvent, IIssue } from './zenhub_reports/src/models'
import * as fs from 'fs'

export interface IMain {
  config0: IMainConfig | undefined
  init: () => void
  run: (conf?: IMainConfig, skipInit?: boolean) => Promise<void>
}

class Main implements IMain {
  private _config0?: IMainConfig
  get config0(): IMainConfig | undefined {
    return this._config0
  }

  init(): void {
    let toDate = new Date(new Date().toDateString()) // hours set to 0
    if (core.getInput('TO_DATE')) {
      toDate = new Date(core.getInput('TO_DATE'))
    }
    let fromDate
    if (core.getInput('FROM_DATE')) {
      fromDate = new Date(core.getInput('FROM_DATE'))
    } else {
      fromDate = new Date(toDate.toDateString())
      fromDate.setMonth(fromDate.getMonth() - 1)
    }

    const repoId = core.getInput('REPO_ID')
    const workspaceId =
      core.getInput('WORKSPACE_ID') || process.env.WORKSPACE_ID
    if (!workspaceId || !repoId) {
      const errMsg = `Need to export WORKSPACE_ID (${workspaceId}) and REPO_ID (${repoId}) (${core.getInput('FROM_PIPELINE')})`
      console.error(errMsg)
      throw new Error(errMsg)
    }

    this._config0 = {
      workspaceId,
      outputJsonFilename: 'output/allEvs.json',
      outputImageFilename: `output/output_average.png`,
      minDate: fromDate.toISOString(),
      maxDate: toDate.toISOString(),
      // labels: [],
      skipRepos: [],
      includeRepos: repoId ? [Number(repoId)] : [],
      // issuesToSkip: [],
      // fromPipeline: 'Backlog',
      // toPipeline: 'Awaiting TESS Review',

      // minDate: '2024-04-18',
      // maxDate: '2024-05-18',
      labels: ['regression'],
      // skipRepos: [93615076],
      // includeRepos: [232779486, 409231566],
      issuesToSkip: [],
      fromPipeline: core.getInput('FROM_PIPELINE'),
      toPipeline: core.getInput('TO_PIPELINE'),

      maxCount: 5,
      release: ''
    }
  }

  async run(conf?: IMainConfig, skipInit = false): Promise<void> {
    let config0: IMainConfig | undefined
    try {
      if (!skipInit && !this.config0?.inputJsonFilename) {
        this.init()
      }

      config0 = conf || this._config0
      if (config0 === undefined) {
        throw new Error('No config specified')
      }
      const config: IMainConfig = config0

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const program = new Program(config)
      // const res = { mark: 'hii' }
      // skip ReBrowse
      const res: IProgramResult = await program.main(
        async (issue: IIssue) => {
          const matchesLabel: boolean =
            config.labels !== undefined &&
            config.labels.some(l => {
              const low = l.toLowerCase()
              return (
                issue.labels !== undefined &&
                issue.labels.map(la => la.toLowerCase()).includes(low)
              )
            })
          const idShouldSkip = !!config.issuesToSkip?.includes(issue.number)

          const skip = !matchesLabel && idShouldSkip
          return Promise.resolve(skip)
        },
        async (event: IGhEvent) => {
          if (!config.minDate || !config.maxDate) {
            return Promise.resolve(false)
          }

          const minDate: Date | undefined = new Date(config.minDate)
          const maxDate: Date | undefined = new Date(config.maxDate)

          const eventDate: Date = new Date(event.createdAt)
          const skip: boolean =
            (minDate !== undefined &&
              eventDate.getTime() < minDate.getTime()) ||
            (maxDate !== undefined && eventDate.getTime() > maxDate.getTime())

          return Promise.resolve(skip)
        }
      )

      const file = 'zenhub_report.md'
      fs.writeFileSync(file, res.mark, { encoding: 'utf8' })
      core.setOutput('markdownContent', res.mark)
    } catch (error) {
      // Fail the workflow run if an error occurs
      if (error instanceof Error) {
        core.setFailed(error.message)
      }
    } finally {
      // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
      core.debug(`Got file ${config0?.inputJsonFilename}`)
    }
  }
}

export const main = new Main()

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  return main.run()
}
