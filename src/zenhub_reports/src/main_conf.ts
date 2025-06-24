export interface IMainConfig {
  inputJsonFilename?: string
  releaseID?: string
  pullRequest?: boolean
  maxCount: number
  workspaceId: string
  outputJsonFilename: string
  outputImageFilename: string
  minDate?: string
  maxDate?: string
  labels?: string[]
  skipRepos: number[]
  includeRepos: number[]
  issuesToSkip?: number[]
  fromPipeline?: string
  toPipeline?: string
  release: string
}

export const mainConfig: IMainConfig = {
  workspaceId: '',
  includeRepos: [],
  outputJsonFilename: 'output/allEvs.json',
  outputImageFilename: `output/output_average.png`,
  minDate: '',
  maxDate: '',
  labels: [],
  skipRepos: [],
  issuesToSkip: [],
  fromPipeline: 'Backlog',
  toPipeline: 'Awaiting TESS Review',
  maxCount: 5,
  release: ''
}
