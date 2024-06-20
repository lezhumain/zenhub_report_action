import * as core from '@actions/core'
import { IProgramResult, Program } from './zenhub_reports/src/zenhub_call'
import * as fs from 'fs'
import { IssueFilter } from './zenhub_reports/src/filters'
import { IMainConfig } from './zenhub_reports/src/main_conf'

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
      const errMsg = `Need to export WORKSPACE_ID (${workspaceId || ''}) and REPO_ID (${repoId}) (${core.getInput('FROM_PIPELINE')})`
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
      includeRepos: repoId ? repoId.split(',').map(r => Number(r.trim())) : [],
      // issuesToSkip: [],
      // fromPipeline: 'Backlog',
      // toPipeline: 'Awaiting TESS Review',

      // minDate: '2024-04-18',
      // maxDate: '2024-05-18',
      labels: core.getInput('LABEL')
        ? core
            .getInput('LABEL')
            .split(',')
            .map(r => r.trim())
        : [],
      // skipRepos: [93615076],
      // includeRepos: [232779486, 409231566],
      issuesToSkip: [],
      fromPipeline: core.getInput('FROM_PIPELINE'),
      toPipeline: core.getInput('TO_PIPELINE'),

      maxCount: 5,
      release: core.getInput('RELEASE') || ''
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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const program = new Program(config0)
      const mainFilter = new IssueFilter(program.config)
      // const res = { mark: 'hii' }
      // skip ReBrowse
      const res: IProgramResult = await program.main(
        mainFilter.filterIssues,
        mainFilter.filterEvents
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
