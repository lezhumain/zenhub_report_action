import * as core from '@actions/core'
import { IMainConfig, Program } from './zenhub_reports/src/zenhub_call'
import { IGhEvent, IIssue } from './zenhub_reports/src/models'
import * as fs from 'node:fs'

const current = new Date()
const minus1month = new Date(current)
minus1month.setMonth(minus1month.getMonth() - 1)

const workspaceId = process.env.WORKSPACE_ID || core.getInput('WORKSPACE_ID')
if (!workspaceId || !process.env.REPO_ID) {
  console.error('Need to export WORKSPACE_ID and REPO_ID')
  process.exit(1)
}

const config: IMainConfig = {
  workspaceId: process.env.WORKSPACE_ID || '5e3018c2d1715f5725d0b8c7',
  outputJsonFilename: 'output/allEvs.json',
  outputImageFilename: `output/output_average.png`,
  minDate: minus1month.toISOString(),
  maxDate: current.toISOString(),
  labels: [],
  skipRepos: [],
  includeRepos: process.env.REPO_ID ? [Number(process.env.REPO_ID)] : [],
  issuesToSkip: [],
  fromPipeline: 'Backlog',
  toPipeline: 'Awaiting TESS Review',
  maxCount: 5,
  release: ''
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const program = new Program(config)
    // skip ReBrowse
    program
      .main(
        (issue: IIssue): Promise<boolean> => {
          const matchesLabel: boolean =
            config.labels !== undefined &&
            config.labels.some(l => {
              const low = l.toLowerCase()
              return (
                issue.labels !== undefined &&
                issue.labels.map(la => la.toLowerCase()).includes(low)
              )
            })
          const idShouldSkip: boolean = !!config.issuesToSkip?.includes(
            issue.number
          )

          const skip = !matchesLabel && idShouldSkip
          return Promise.resolve(skip)
        },
        (event: IGhEvent): Promise<boolean> => {
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
      .then((res: any) => {
        const file = 'zenhub_report.md'
        fs.writeFileSync(file, res.mark, { encoding: 'utf8' })
        core.setOutput('markdownContent', res.mark)
        // core.setOutput('markdownFile', file);
        // console.log('markdownContent', res.mark)
      })
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
      // console.log(error.message)
    }
  }
}
