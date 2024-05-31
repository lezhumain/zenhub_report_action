import { IMainConfig, Program } from './zenhub_call'
import { IssueFilter } from './filters'

const current = new Date(new Date().toDateString())
const minus1month = new Date(current)
minus1month.setMonth(minus1month.getMonth() - 3)

const config0: IMainConfig = {
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
// 	workspaceId: "",
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
  Object.assign(config0, argConfig) // source's `undefined` properties will not be skipped, need to delete
}

const program = new Program(config0)
const mainFilter = new IssueFilter(program.config)

// skip ReBrowse
program.main(mainFilter.filterIssues, mainFilter.filterEvents)
