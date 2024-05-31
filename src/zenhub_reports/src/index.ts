import { IMainConfig, Program } from './zenhub_call'
import { IIssue, Utils } from './models'

const current = new Date(new Date().toDateString())
const minus1month = new Date(current)
minus1month.setMonth(minus1month.getMonth() - 3)

const config: IMainConfig = {
  // workspaceId: process.env.WORKSPACE_ID || '5e3018c2d1715f5725d0b8c7',
  // includeRepos: process.env.REPO_ID ? [Number(process.env.REPO_ID)] : [],
  workspaceId: process.env.WORKSPACE_ID!,
  includeRepos: [Number(process.env.REPO_ID)],
  outputJsonFilename: 'output/allEvs.json',
  outputImageFilename: `output/output_average.png`,
  minDate: minus1month.toISOString(),
  maxDate: current.toISOString(),
  labels: ['regression'],
  skipRepos: [],
  issuesToSkip: [],
  fromPipeline: 'Backlog',
  toPipeline: 'Awaiting TESS Review',
  maxCount: 5,
  release: ''
}

// TODO: fix PR and commits data
// const config: IMainConfig = {
// 	workspaceId: "582ffb92abc60d5d34359ef4",
// 	outputJsonFilename: "output/allEvs.json",
// 	outputImageFilename: `output/output_average.png`,
// 	minDate: undefined,
// 	maxDate: undefined,
// 	labels: [],
// 	skipRepos: [],
// 	includeRepos: [],
// 	issuesToSkip: [],
// 	fromPipeline: undefined,
// 	toPipeline: "Awaiting PRODUCTION Release",
// 	maxCount: 5,
// 	release: "2.19"
// }

const args = process.argv.slice(2)
const argConfig: Partial<IMainConfig> = {
  workspaceId: args[0] || undefined,
  minDate: args[1] || undefined,
  maxDate: args[2] || undefined,
  labels: args[3] ? JSON.parse(args[3]) : undefined,
  skipRepos: args[4] ? JSON.parse(args[4]) : undefined,
  includeRepos: args[5] ? JSON.parse(args[5]) : undefined,
  issuesToSkip: args[6] ? JSON.parse(args[6]) : undefined,
  fromPipeline: args[7] || undefined,
  toPipeline: args[8] || undefined,
  maxCount: Number(args[9]) || undefined,
  release: args[10] || undefined
}

if (args.length > 0) {
  Object.assign(config, argConfig) // source's `undefined` properties will not be skipped, need to delete
}

const program = new Program(config)
// const mainFilter = new IssueFilter(config)
// skip ReBrowse
program.main(
  async (issue: IIssue) => {
    const matchesLabel: boolean =
      config.labels !== undefined &&
      config.labels.some((l: string) => {
        const low = l.toLowerCase()
        return (
          issue.labels !== undefined &&
          issue.labels.map((la: string) => la.toLowerCase()).includes(low)
        )
      })
    const idShouldSkip = !!config.issuesToSkip?.includes(
      Utils.issueNumberAsNumber(issue.number)
    )
    const skip = !matchesLabel && idShouldSkip
    return Promise.resolve(skip)
  },
  async (event: any) => {
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
