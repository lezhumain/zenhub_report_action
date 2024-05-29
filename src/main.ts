import * as core from '@actions/core'
import {
  IMainConfig,
  IProgramResult,
  Program
} from './zenhub_reports/src/zenhub_call'
import { IGhEvent, IIssue } from './zenhub_reports/src/models'
import * as fs from 'node:fs'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import html from './zenhub_reports/src/index.html';

let toDate = new Date(new Date().toDateString()) // hours set to 0
if(core.getInput('TO_DATE')) {
  toDate = new Date(core.getInput('TO_DATE'))
}
let fromDate;
if(core.getInput('FROM_DATE')) {
  fromDate = new Date(core.getInput('FROM_DATE'))
} else {
  fromDate = new Date(toDate.toDateString())
  fromDate.setMonth(fromDate.getMonth() - 1)
}

// const current = new Date(new Date().toDateString()) // hours set to 0
// const minus1month = new Date(current)
// minus1month.setMonth(minus1month.getMonth() - 1)

// const workspaceId = process.env.WORKSPACE_ID || core.getInput('WORKSPACE_ID')
const workspaceId = core.getInput('WORKSPACE_ID') || process.env.WORKSPACE_ID
if (!workspaceId || !process.env.REPO_ID) {
  console.error('Need to export WORKSPACE_ID and REPO_ID')
  process.exit(1)
}

export const config0: IMainConfig = {
  workspaceId: workspaceId,
  outputJsonFilename: 'output/allEvs.json',
  outputImageFilename: `output/output_average.png`,
  minDate: fromDate.toISOString(),
  maxDate: toDate.toISOString(),
  // labels: [],
  skipRepos: [],
  includeRepos: core.getInput('REPO_ID') ? [Number(core.getInput('REPO_ID'))] : [],
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

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(conf?: IMainConfig): Promise<void> {
  const config = conf || config0
  try {
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
          (minDate !== undefined && eventDate.getTime() < minDate.getTime()) ||
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
    core.debug(`Got file ${config.inputJsonFilename}`)

    // // Log the current timestamp, wait, then log the new timestamp
    // core.debug(new Date().toTimeString())
    // await wait(parseInt(ms, 10))
    // core.debug(new Date().toTimeString())
  }
}
