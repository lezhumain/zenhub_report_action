import { Program } from './zenhub_call'
import { IssueFilter } from './filters'
import { IMainConfig, mainConfig } from './main_conf'

const current = new Date(new Date().toDateString())
// current.setMonth(current.getMonth() - 4)
// const minus1month = new Date(current)
// minus1month.setMonth(minus1month.getMonth() - 4)
// const minus1month = new Date(current.getTime() - 14 * 24 * 60 * 60 * 1000)
const minus1month = new Date('08/09/2024')

export const config0: IMainConfig = Object.assign({}, mainConfig)
config0.workspaceId = process.env.WORKSPACE_ID || ''
config0.includeRepos = process.env.REPO_ID
  ? process.env.REPO_ID.split(',').map(m => Number(m))
  : []
config0.minDate = minus1month.toISOString()
config0.maxDate = current.toISOString()

const args = process.argv.slice(2)
const argConfig: Partial<IMainConfig> = {
  workspaceId: args[0] || undefined,
  minDate: args[1] || undefined,
  maxDate: args[2] || undefined,
  labels: args[3] ? JSON.parse(args[3]) : undefined,
  skipRepos: args[4] ? JSON.parse(args[4]) : undefined,
  // includeRepos: args[5] ? JSON.parse(args[5]) : ['BrowserPuppeteerTests', "CucuVAPI"],
  includeRepos: args[5] ? JSON.parse(args[5]) : [409231566],
  issuesToSkip: args[6] ? JSON.parse(args[6]) : undefined,
  fromPipeline: args[7] || undefined,
  toPipeline: args[8] || undefined,
  maxCount: Number(args[9]) || undefined,
  release: args[10] || undefined
}

for (const key of Object.keys(argConfig)) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!argConfig[key]) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete argConfig[key]
  }
}

// if (args.length > 0) {
//   Object.assign(config0, argConfig) // source's `undefined` properties will not be skipped, need to delete
// }
Object.assign(config0, argConfig) // source's `undefined` properties will not be skipped, need to delete

const program = new Program(config0)
const mainFilter = new IssueFilter(program.config)

// skip ReBrowse
program.main(mainFilter.filterIssues, mainFilter.filterEvents)
