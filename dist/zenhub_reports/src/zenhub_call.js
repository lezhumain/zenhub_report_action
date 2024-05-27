"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Program = exports.FileUtils = void 0;
/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/no-require-imports */
const md5_1 = __importDefault(require("md5"));
const fs = __importStar(require("fs"));
const chart_helper_1 = require("./chart_helper");
const models_1 = require("./models");
const path = __importStar(require("node:path"));
const reviewer_call = require('./check_pr_reviewers.js');
/*
    Takes issues that moved during a timespan
 */
const apiKey = process.env.API_KEY;
class FileUtils {
    static fileExists(filePath) {
        const ff = fs;
        return fs.existsSync(filePath);
    }
}
exports.FileUtils = FileUtils;
class Program {
    _delim;
    _configHash;
    _baseFilename = 'workspace';
    _file;
    _config;
    _errorMessages = [];
    /**
     * Started and completed with option date range
     * @private
     */
    _completed = [];
    _pipelines = [];
    _startTimestamp = 0;
    _estimateRemainingMs = 0;
    _estimateRemainingPrveiousMs = 0;
    _eventsPerIssue = {};
    _preparedHTML = [];
    _issueQueryTemplate = `pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
          nodes {
            number
            repository {
              ghId
              name
            }
            estimate {
              value
            }
            labels {
              nodes {
                name
              }
            }
            releases {
              nodes {
                title
                id
              }
            }
          }
        }`;
    _bubbleBaseWith = 10;
    _mainOutputFolder;
    constructor(config) {
        this._delim = ',';
        const defaultConfig = {
            workspaceId: '5e3018c2d1715f5725d0b8c7',
            outputJsonFilename: 'output/allEvs.json',
            outputImageFilename: `output/output_average.png`,
            minDate: '2024-04-18T00:00:00Z',
            maxDate: '2024-05-18T23:59:59Z',
            labels: ['regression'],
            skipRepos: [93615076],
            includeRepos: [],
            issuesToSkip: [],
            fromPipeline: 'New Issues',
            toPipeline: 'Awaiting TESS Review',
            maxCount: 0,
            pullRequest: false,
            release: ''
        };
        this._config = Object.assign(defaultConfig, config);
        const currentFolder = process.cwd();
        const outputJsonFilename = path.join(...this._config.outputJsonFilename.split('/'));
        this._config.outputJsonFilename = path.join(currentFolder, outputJsonFilename);
        const outputImageFilename = path.join(...this._config.outputImageFilename.split('/'));
        this._config.outputImageFilename = path.join(currentFolder, outputImageFilename);
        this._mainOutputFolder = path.join(currentFolder, 'output');
        for (const target of [
            this._config.outputJsonFilename,
            this._config.outputImageFilename
        ]) {
            const targetFolder = path.dirname(target);
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder);
            }
        }
        for (const key of Object.keys(this._config)) {
            // @ts-ignore
            if (!this._config[key]) {
                // @ts-ignore
                // this._config[key] = undefined;
                delete this._config[key];
            }
        }
        this._configHash = (0, md5_1.default)(JSON.stringify(this._config));
        this._file = path.join(this._mainOutputFolder, `${this._baseFilename}_${this._configHash}.json`);
        console.log(`Target file: ${this._file}`);
    }
    async generateChartFromObj(title, evs, fileName, param3) {
        const csv = this.get_csv(evs);
        // await generateExcelPieChart(csv, 'output.xlsx', "Pie Chart Data", "D", "A");
        return this.generateChart(title, csv, fileName, param3);
    }
    toCSV(myArr, withDate, title, lastLineFn) {
        if (myArr.length === 0) {
            return '';
        }
        const keys = (withDate ? ['Date'] : []).concat(Object.keys(myArr[0]));
        const csvHeaders = `${keys.join(this._delim)}\n`;
        const datePart = withDate ? `${new Date().toUTCString()}${this._delim}` : '';
        let csvData = '';
        for (const arrItem of myArr) {
            csvData += datePart;
            // for (const key of keys) {
            // 	csvData += arrItem[key] + this._delim;
            // }
            csvData += `${keys.map(k => arrItem[k]).join(this._delim)}\n`;
        }
        if (lastLineFn) {
            csvData += lastLineFn(this._delim);
        }
        return `${title?.replace(/,/g, '_') || ''}\n${csvHeaders}${csvData}`;
    }
    generateAllCSV(title, report) {
        const date = new Date();
        const all = this.getAllCSV(report, date);
        const mainCSV = `${all.csvChart}\n\n${all.csvOutstanding}\n\n${all.velocityList}\n\n${all.mainList}\n\n${all.csvPrAndCommits}`;
        fs.writeFileSync(path.join(this._mainOutputFolder, 'main_report.csv'), mainCSV, { encoding: 'utf8' });
        return all;
    }
    async generateChart(title, csvData, outputFile, sizeObj) {
        // Parse the CSV data
        const items = this.csvDataToChartItems(csvData);
        await chart_helper_1.ChartHelper.generateChartFromObj(title, items, outputFile, sizeObj);
        return Promise.resolve(items);
    }
    async handleIssue(issueObj, skipEventIfFn, doGen = false, fromPipeline = 'New Issues', toPipeline = 'Awaiting TESS Review') {
        const issueNumber = issueObj.number;
        const events = issueObj.events ||
            (await this.getEvents(issueObj.repositoryGhId, issueNumber).catch(err => {
                this._errorMessages.push(err.message);
                return [];
            }));
        events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const move_events = events.filter((e) => e.type === 'issue.change_pipeline');
        // console.log(move_events);
        const filteredEvents = [];
        for (const event of move_events) {
            if (skipEventIfFn !== undefined && (await skipEventIfFn(event))) {
                continue;
            }
            filteredEvents.push(event);
        }
        if (filteredEvents.length > 1) {
            const firstFrom = filteredEvents[0].data.from_pipeline.name;
            const lastTo = filteredEvents[filteredEvents.length - 1].data.to_pipeline.name;
            const reachedCompletionOrFurther = this.comparePipelines(lastTo, toPipeline) >= 0;
            if (firstFrom !== lastTo &&
                this.comparePipelines(firstFrom, fromPipeline) <= 0 &&
                reachedCompletionOrFurther) {
                this._completed.push(issueObj);
            }
        }
        // const completedEvent: IGhEvent | undefined = move_events.find(me => this.comparePipelines(me.data.to_pipeline.name, toPipeline) >= 0);
        const completedEvent = move_events.find(me => this.comparePipelines(me.data.to_pipeline.name, toPipeline) >= 0);
        if (completedEvent !== undefined) {
            const startEvent = move_events
                .slice()
                .reverse()
                .find(me => {
                return (this.comparePipelines(me.data.to_pipeline.name, fromPipeline) >=
                    0 &&
                    this.comparePipelines(me.data.from_pipeline.name, fromPipeline) < 0);
            });
            issueObj.completed = {
                start: new Date((startEvent || move_events[0]).createdAt),
                end: new Date(completedEvent.createdAt)
            };
        }
        // await print_timings(filteredEvents);
        const evs = this.mapToUsefull(filteredEvents, issueObj?.estimateValue, issueObj.number);
        if (doGen) {
            try {
                await this.generateChartFromObj('', evs, `output_issue_${issueNumber}.png`, { width: 1600, height: 1200 });
            }
            catch (err) {
                console.error(err.message);
            }
        }
        return Promise.resolve({
            csvItems: evs,
            events: move_events
        });
    }
    getAverages(allEvs) {
        const avgObj = {};
        for (const ev of allEvs) {
            if (!avgObj[ev.pipeline]) {
                avgObj[ev.pipeline] = {
                    data: {
                        count: 1,
                        duration: ev.duration,
                        durationDays: models_1.Utils.getMsAsDays(ev.duration),
                        durationAverage: 0,
                        durationString: '',
                        durationAverageString: ''
                    },
                    issueCount: 0, // will be done at the end
                    openedIssueCount: 0
                };
            }
            else {
                avgObj[ev.pipeline].data.count++;
                avgObj[ev.pipeline].data.duration += ev.duration;
            }
        }
        for (const pipelineKey of Object.keys(avgObj)) {
            avgObj[pipelineKey].data.durationString =
                models_1.Utils.millisecondsToHumanReadableTime(avgObj[pipelineKey].data.duration);
            avgObj[pipelineKey].data.durationAverage = Number((avgObj[pipelineKey].data.duration / avgObj[pipelineKey].data.count).toFixed(0));
            avgObj[pipelineKey].data.durationAverageString =
                models_1.Utils.millisecondsToHumanReadableTime(avgObj[pipelineKey].data.durationAverage);
        }
        return avgObj;
    }
    mapToUsefull(move_events, estimateValue = 0, issueNumber) {
        // return move_events.map((mo) => {
        // 	return {
        // 		duration:
        // 	}
        // });
        // const res = [];
        // for(let i = 1; i < move_events.length - 1; i++) {
        const res = move_events.slice(1).map((ev, i) => {
            const prevEv = move_events[i];
            // const ev = move_events[i];
            const diff = new Date(ev.createdAt).getTime() - new Date(prevEv.createdAt).getTime();
            const diffPerEstimate = estimateValue > 0
                ? Number((diff / estimateValue).toFixed(1))
                : undefined;
            return {
                duration: diff,
                durationString: models_1.Utils.millisecondsToHumanReadableTime(diff),
                durationPerEstimate: diffPerEstimate,
                durationStringPerEstimate: diffPerEstimate !== undefined
                    ? models_1.Utils.millisecondsToHumanReadableTime(diffPerEstimate)
                    : undefined,
                pipeline: prevEv.data.to_pipeline.name,
                event: `${prevEv.data.to_pipeline.name} to ${ev.data.to_pipeline.name}`,
                issueNumber
            };
        });
        // }
        return res;
    }
    get_csv(evs) {
        let str = `Pipeline${this._delim}Event${this._delim}Human readable duration${this._delim}Duration\n`;
        for (const ev of evs) {
            str += `${ev.pipeline}${this._delim}${ev.event}${this._delim}${ev.durationString}${this._delim}${ev.duration}\n`;
        }
        return str;
    }
    async callZenhub(query, variables) {
        // const endpoint = 'https://api.zenhub.io/graphql';
        const endpoint = 'https://api.zenhub.com/public/graphql';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ query, variables })
        });
        if (!response.ok) {
            throw new Error('Failed to fetch ZenHub API');
        }
        return response.json();
        // .then(data => {
        // 	console.log(data);
        // })
        // .catch(error => {
        // 	console.error(error);
        // })
    }
    async getEvents(repositoryGhId, issueNumber, last = 50) {
        const query = `query getTimelineItems($repositoryGhId: Int!, $issueNumber: Int!) {
  issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
    id
    timelineItems(last: ${last}) {
      nodes {
        type: key
        data
        createdAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;
        const variables = { repositoryGhId, issueNumber };
        const res = await this.callZenhub(query, variables);
        const events = res.data?.issueByInfo.timelineItems.nodes || [];
        return Promise.resolve(events);
    }
    async getPipelines(workspaceId) {
        const query = `query getBoardInfoForWorkspace($workspaceId: ID!) {
  workspace(id: $workspaceId) {
    id
    pipelinesConnection(first: 25) {
      nodes {
        name
      }
    }
  }
}`;
        const variables = { workspaceId };
        const res1 = await this.callZenhub(query, variables);
        const res = res1.data.workspace.pipelinesConnection.nodes.map((res) => res.name);
        return Promise.resolve(res);
    }
    async getPipelinesFromBoard(board) {
        return Promise.resolve(board.pipelinesConnection.map((p) => {
            return p.name;
        }));
    }
    async getPipelineIssues(pipelineId, releaseIds = [], labels = [], issueCursor = '', last = 100) {
        const query = `query getIssuesByPipeline($pipelineId: ID!, $filters: IssueSearchFiltersInput!, $issueCursor: String) {
  searchIssuesByPipeline(pipelineId: $pipelineId, filters: $filters, first: ${last}, after: $issueCursor) {
    ${this._issueQueryTemplate}
  }
}`;
        // releaseIds = ["Z2lkOi8vcmFwdG9yL1JlbGVhc2UvOTc3MTk"];
        const variables = {
            pipelineId,
            filters: {},
            issueCursor
        };
        if (releaseIds.length > 0) {
            // @ts-ignore
            variables.filters.releases = { in: releaseIds };
        }
        if (labels.length > 0) {
            // @ts-ignore
            variables.filters.labels = { in: labels };
        }
        const res1 = await this.callZenhub(query, variables);
        // const issues: Issue[] = res1.data.searchIssuesByPipeline.nodes.reduce((res: IIssue[], ee: Issue) => {
        // 	return res.concat([{
        // 		number: Number(ee.number),
        // 		estimateValue: ee.estimate !== null ? Number(ee.estimate.value) : undefined,
        // 		repositoryGhId: Number(ee.repository.ghId),
        // 		labels: ee.labels?.nodes?.map((n: any) => n.name) || undefined
        // 	} as IIssue]);
        // }, []);
        return Promise.resolve(res1.data.searchIssuesByPipeline);
    }
    async getIssues(workspaceId, last = 100) {
        const query = `query getBoardInfoForWorkspace($workspaceId: ID!) {
  workspace(id: $workspaceId) {
    id
    pipelinesConnection(first: 25) {
      nodes {
        id
        name
        issues(last: ${last}) {
          nodes {
            number
            estimate {
              value
            }
            repository {
              ghId
            }
            labels(first: 3) {
              nodes {
                name
              }
            }
          }
		  pageInfo {
			hasNextPage
			endCursor
		  }
        }
      }
    }
  }
}`;
        const variables = { workspaceId };
        const res1 = await this.callZenhub(query, variables);
        const issues = res1.data.workspace.pipelinesConnection.nodes.reduce((res, item) => {
            const eventsTmp = item.issues.nodes;
            const issues0 = eventsTmp.map((ee) => {
                return {
                    number: Number(ee.number),
                    estimateValue: ee.estimate !== null ? Number(ee.estimate.value) : undefined,
                    repositoryGhId: Number(ee.repository.ghId),
                    pipelineName: item.name,
                    labels: ee.labels?.nodes?.map((n) => n.name) || undefined
                };
            });
            return res.concat(issues0);
        }, []);
        return Promise.resolve(issues);
    }
    async getIssuesFromBoard(board) {
        const issues = board.pipelinesConnection.reduce((res, item) => {
            const eventsTmp = item.issues;
            const issues0 = eventsTmp.map((ee) => {
                const o = {
                    number: Number(ee.number),
                    estimateValue: ee.estimate !== null && ee.estimate !== undefined
                        ? Number(ee.estimate.value)
                        : undefined,
                    repositoryGhId: Number(ee.repository.ghId),
                    pipelineName: item.name,
                    labels: ee.labels?.nodes?.map((n) => n.name) || undefined,
                    releases: ee.releases?.nodes?.map((n) => n.title) || undefined,
                    events: ee.events,
                    pullRequest: ee.pullRequest
                };
                return o;
            });
            return res.concat(issues0);
        }, []);
        return Promise.resolve(issues);
    }
    async getBoardFull(workspaceId, last = 73) {
        console.log('Getting board data');
        const base = await this.getBoard(workspaceId, last);
        this._config.releaseID = await this.getReleases(workspaceId);
        for (const pieline of base.pipelinesConnection) {
            const pipelineID = pieline.id;
            let endCursor = pieline.issueEndCursor;
            while (endCursor !== undefined) {
                const moreData = await this.getPipelineIssues(pipelineID, this._config.releaseID !== undefined ? [this._config.releaseID] : [], this._config.labels || [], endCursor);
                // console.log(moreData);
                pieline.issues.push(...moreData.nodes);
                endCursor = moreData.pageInfo.hasNextPage
                    ? moreData.pageInfo.endCursor
                    : undefined;
                // pieline.issues.push(...this.ma)
            }
        }
        return Promise.resolve(base);
    }
    async getReleases(workspaceId) {
        // TODO last
        const query = `query getCurrentWorkspace($workspaceId: ID!) {
  workspace: workspace(id: $workspaceId) {
    ...currentWorkspace
  }
}

fragment currentWorkspace on Workspace {
  pipelinesConnection(first:9) {
    nodes {
      issues(last: 100) {
        pageInfo {
          endCursor
          startCursor
          hasPreviousPage
        }
        nodes {
          releases {
            nodes {
            title
            id
            }
          }
        }
      }
    }
  }
}`;
        const variables = { workspaceId };
        const res1 = await this.callZenhub(query, variables);
        const err = res1.errors?.map((e) => e.message) || [];
        if (err.length > 0) {
            return Promise.reject(new Error(err.join('\n')));
        }
        const releases = Array.from(new Set([]
            .concat(...[]
            .concat(...res1.data.workspace.pipelinesConnection.nodes.map((n) => n.issues.nodes.map((nn) => nn.releases.nodes)))
            .filter((l) => l.length > 0))
            .map((y) => `${y.title}:${y.id}`)));
        return releases
            .find((r) => r.startsWith(`${this._config.release}:`))
            ?.split(':')[1];
    }
    async getBoard(workspaceId, last = 73) {
        // TODO last
        const query = `query getCurrentWorkspace($workspaceId: ID!) {
  workspace: workspace(id: $workspaceId) {
    ...currentWorkspace
    __typename
  }
}

fragment currentWorkspace on Workspace {
  name
  id
  displayName
  pipelinesConnection(first:100) {
    nodes {
      id
      name
      issues(first:${last}) {
        ${this._issueQueryTemplate}
    }
  }
}`;
        const variables = { workspaceId };
        const res1 = await this.callZenhub(query, variables);
        const err = res1.errors?.map((e) => e.message) || [];
        if (err.length > 0) {
            return Promise.reject(new Error(err.join('\n')));
        }
        const finalRes = Object.assign({ totalIssues: 0 }, res1.data.workspace);
        finalRes.pipelinesConnection = this.mapPipelineConnec(finalRes);
        return Promise.resolve(finalRes);
    }
    generateMainCSV(avg, date, stats, statsEstimate, veloccity) {
        const keys = Object.keys(avg);
        const csvHeaders = `Date${this._delim}${keys.join(this._delim)}` +
            `${this._delim}${keys.map(k => `${k} Issues`).join(this._delim)}` +
            `${this._delim}Completed,From Pipeline,To Pipeline,From Date,To Date,Working Days,Days/issue,Median,Days/estimate,Median estimate,Velocity (issue),Velocity(estimate)\n`;
        let csv = `${date.toISOString()}`;
        for (const key of keys) {
            csv += `${this._delim}${avg[key].data.durationDays.toFixed(2)}`;
        }
        for (const key of keys) {
            csv += `${this._delim}${avg[key].issueCount}`;
        }
        csv += `${this._delim}${this._completed.length}`;
        csv += `${this._delim}${this._config.fromPipeline}${this._delim}${this._config.toPipeline}`;
        csv += `${this._delim}${this._config.minDate}${this._delim}${this._config.maxDate}`;
        csv += `${this._delim}${this._config.minDate && this._config.maxDate
            ? this.getWorkingDays(new Date(this._config.minDate), new Date(this._config.maxDate))
            : ''}`;
        csv +=
            `${this._delim}${stats.average}${this._delim}${stats.median}${this._delim}${statsEstimate.average}` +
                `${this._delim}${statsEstimate.median}${this._delim}${veloccity.velocityIssue}${this._delim}${veloccity.velocityEstimate}\n`;
        const allCSV = csvHeaders + csv;
        const outputPath = path.join(this._mainOutputFolder, 'main.csv');
        const writeCSV = fs.existsSync(outputPath) ? csv : csvHeaders + csv;
        fs.writeFileSync(outputPath, writeCSV, { encoding: 'utf8', flag: 'a' });
        return allCSV;
    }
    generateHTML(outstanding) {
        const csv = fs.readFileSync(path.join(this._mainOutputFolder, 'main.csv'), { encoding: 'utf8' });
        const html = fs
            .readFileSync(path.join(__dirname, 'index.html'), {
            encoding: 'utf8'
        })
            .replace('__DATA__', csv)
            .replace('__OUTS__', JSON.stringify(outstanding, null, 2));
        fs.writeFileSync(path.join(this._mainOutputFolder, 'index.html'), html, {
            encoding: 'utf8'
        });
    }
    updateHTML(baseFile = path.join(this._mainOutputFolder, 'index.html'), outFile = path.join(this._mainOutputFolder, 'index.html'), tag = '__MORE__', html) {
        const htmlContent = fs
            .readFileSync(baseFile, { encoding: 'utf8' })
            .replace(tag, html);
        fs.writeFileSync(outFile, htmlContent, { encoding: 'utf8' });
    }
    writeMoreHTML() {
        this.updateHTML(path.join(this._mainOutputFolder, 'index.html'), path.join(this._mainOutputFolder, 'index.html'), '__MORE__', this._preparedHTML.join(''));
    }
    addControlChartListHTML(chartData) {
        const htmlTableString = this.generateTable(chartData);
        this._preparedHTML.push(`<div class="control-chart-list"><h3>Control Chart list</h3>${htmlTableString}</div>`);
    }
    getWorkingDays(currentDate, endDate) {
        let count = 0;
        while (currentDate.getTime() <= endDate.getTime()) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return count;
    }
    comparePipelines(firstFrom, fromPipeline) {
        // return firstFrom === fromPipeline;
        return (this._pipelines.indexOf(firstFrom) - this._pipelines.indexOf(fromPipeline));
    }
    findOutstandingIssues(allEvs) {
        const flat = allEvs.reduce((res, item) => {
            res.data.push(...item);
            res.sum += item.reduce((res0, item0) => res0 + item0.duration, 0);
            return res;
        }, { data: [], sum: 0 });
        flat.data.sort((a, b) => {
            return a.duration - b.duration;
        });
        const avg = flat.sum / flat.data.length;
        return flat.data.filter((ff) => ff.duration > avg);
    }
    async main(skipIssueIfFn, skipEventIfFn) {
        // const pipelines: string[] = await this.getPipelines(this._config.workspaceId);
        // this._pipelines = pipelines
        //
        // const issues = await this.getIssues(this._config.workspaceId)
        // 	.catch((err) => {
        // 		this._errorMessages.push(err.message);
        // 		return [];
        // 	});
        // const board: IWorkspace = await this.getBoardFull(this._config.workspaceId);
        const board = this.getFromFile() ||
            (await this.getBoardFull(this._config.workspaceId, this._config.maxCount) // this.getBoard(this._config.workspaceId)
                .then((b) => {
                b.configHash = this._configHash;
                return b;
            })
                .catch(err => {
                this._errorMessages.push(err.message);
                return null;
            }));
        if (board === null) {
            const msg = process.env.API_KEY
                ? `Couldn't get board data for ${this._config.workspaceId}`
                : 'Need to export API_KEY';
            for (const err of this._errorMessages) {
                console.error(err);
            }
            throw new Error(msg);
        }
        const issues = await this.getIssuesFromBoard(board);
        // const pipelines: string[] = await this.getPipelines(this._config.workspaceId);
        const pipelines = await this.getPipelinesFromBoard(board);
        this._pipelines = pipelines;
        this._startTimestamp = Date.now();
        const allEvs = [];
        let handledCount = 0;
        for (let i = 0; i < issues.length; ++i) {
            console.clear();
            if (this._errorMessages.length > 0) {
                console.log(this._errorMessages.join('\n'));
            }
            const handledPerc = i / issues.length;
            console.log(`${i} / ${issues.length} (${(handledPerc * 100).toFixed(1)}%)`);
            this.printRemaining(i, issues.length);
            const issue = issues[i];
            if (!!issue.pullRequest !== !!this._config.pullRequest ||
                (this._config.labels &&
                    this._config.labels.length > 0 &&
                    !issue.labels?.some(la => this._config.labels?.includes(la.toLowerCase()))) ||
                (this._config.skipRepos.length > 0 &&
                    this._config.skipRepos.includes(issue.repositoryGhId)) ||
                (this._config.includeRepos.length > 0 &&
                    !this._config.includeRepos.includes(issue.repositoryGhId)) ||
                (!!this._config.release &&
                    !issue.releases?.includes(this._config.release)) ||
                (skipIssueIfFn !== undefined && (await skipIssueIfFn(issue)))) {
                issue.filtered = true;
                continue;
            }
            // if (this._config.maxCount > 0 && handledCount === this._config.maxCount) {
            // 	break;
            // }
            const handleIssueResult = await this.handleIssue(issue, skipEventIfFn, false, this._config.fromPipeline, this._config.toPipeline);
            const evs = handleIssueResult.csvItems;
            if (evs.length > 0) {
                allEvs.push(evs);
                issue.handled = true;
                handledCount++;
            }
            this._eventsPerIssue[issue.number.toString()] = handleIssueResult.events;
        }
        // fs.writeFileSync(this._config.outputJsonFilename, JSON.stringify(allEvs, null, 2), {encoding: 'utf8'}); // done at the end
        const remainingOpenedIssues = issues.filter(iu => !iu.completed && !iu.filtered);
        // @ts-ignore
        const avg = this.getAverages([].concat(...allEvs));
        for (const pipeline of Object.keys(avg)) {
            // TODO use all pipelines
            avg[pipeline].issueCount = issues.filter(is => is.pipelineName === pipeline && !is.filtered).length;
            // avg[pipeline].openedIssueCount = remainingOpenedIssues.filter(r => r.pipelineName === pipeline).length
        }
        const openedPipelines = Array.from(new Set(remainingOpenedIssues.map(r => r.pipelineName)));
        const openedPerPipeline = openedPipelines.map((pipeline) => {
            return {
                pipeline,
                opened: remainingOpenedIssues.filter(r => r.pipelineName === pipeline)
                    .length
            };
        });
        // const remainingPerPipeline = Object.keys(avg).map((pipeline: string) => {
        // 	return {
        // 		pipeline,
        // 		remsiningCount: avg[pipeline].openedIssueCount
        // 	}
        // });
        fs.writeFileSync(this._config.outputJsonFilename.replace('.json', '_averages.json'), JSON.stringify(avg, null, 2), { encoding: 'utf8' });
        const evs = Object.keys(avg).map((pipeline) => {
            const avgPipeline = avg[pipeline];
            return {
                duration: avgPipeline.data.duration,
                durationString: avgPipeline.data.durationString,
                durationPerEstimate: undefined,
                durationStringPerEstimate: undefined,
                pipeline,
                event: '',
                issueNumber: -1
            };
        });
        const date = new Date();
        const timeChartItems = await this.generateChartFromObj(`Time spent in pipelines on ${date.toISOString()} (${handledCount} issues)`, evs, this._config.outputImageFilename, {
            width: 1600,
            height: 1200
        });
        console.log(JSON.stringify(avg, null, 2));
        const countChartItems = Object.keys(avg).map((pipeline) => {
            return {
                label: pipeline,
                data: avg[pipeline].issueCount
            };
        });
        console.log(`Handled ${handledCount} issues`);
        await chart_helper_1.ChartHelper.generateChartFromObj(`Total issues in pipelines on ${date.toISOString()} (${issues.length} issues)`, countChartItems, this._config.outputImageFilename.replace('.png', '_issues.png'), { width: 1600, height: 1200 });
        board.pipelinesConnection.forEach((pipelineConnect) => {
            pipelineConnect.issues.forEach((issue) => {
                // if(issue.number) {
                // 	issue.events = issue.number;
                // } else {
                // 	const issueNumberBits = issue.htmlUrl?.split("/") || [];
                // 	const issueNumber = issueNumberBits[issueNumberBits.length - 1];
                // 	issue.events = this._eventsPerIssue[issueNumber] || [];
                // }
                let issueNumber;
                if (issue.number) {
                    issueNumber = issue.number;
                }
                else {
                    const issueNumberBits = issue.htmlUrl?.split('/') || [undefined];
                    issueNumber = issueNumberBits[issueNumberBits.length - 1];
                }
                issue.events = issueNumber
                    ? this._eventsPerIssue[issueNumber] || []
                    : [];
            });
        });
        fs.writeFileSync(this._file, JSON.stringify(board, null, 2), {
            encoding: 'utf8'
        });
        console.log(`Wrote file ${this._file}`);
        const chartData = this.getControlChartData(issues);
        console.log(chartData);
        const completinList = chartData.map(c => Number(c.completionTimeStr));
        const stats = models_1.StatHelper.getStats(completinList);
        // const chartWithEstimate: IControlChartItem[] = chartData.filter((cd: IControlChartItem) => cd.estimate > 0);
        // const completinListEstimate: number[] = chartWithEstimate.map((c: IControlChartItem) => Number(c.completionTimeStr));
        // const completionTot: number = completinListEstimate.reduce((res: number, item: number) => res + item, 0);
        // const estimateTot: number = chartWithEstimate.reduce((res: number, item: IControlChartItem) => res + item.estimate, 0);
        // const averagePerEstimate: number = completionTot / estimateTot;
        const completinEstimateList = chartData
            .filter((cd) => cd.estimate > 0)
            .map(c => Number(c.completionTimeStr) / c.estimate);
        const statsEstimate = models_1.StatHelper.getStats(completinEstimateList);
        const veloccity = this.getVelocity(chartData);
        // this.generateMainCSV(avg, date, stats, statsEstimate, veloccity);
        const outs = this.findOutstandingIssues(allEvs).slice(0, 5);
        // console.log(JSON.stringify(outs, null, 2));
        const stuff = board.pipelinesConnection.map((pc) => pc.issues.map((pci) => pci.repository.name));
        const repos = Array.from(new Set([].concat(...stuff)));
        // const allD: ICheckPr[] = await Promise.all(
        // 	repos.map(repo => {
        // 		return reviewer_call.check_prs(repo, this._config).catch((err: Error) => {
        // 			console.error(err.message);
        // 			return {
        // 				summary: [],
        // 				users:[]
        // 			};
        // 		}) as ICheckPr;
        // 	})
        // );
        const res = await this.getGithubData(repos);
        // const allD: ICheckPr[] = res.allD;
        const newAllD = res.newAllD;
        const allResult = {
            chartTime: timeChartItems,
            chartCount: countChartItems,
            statsIssue: stats,
            statsEstimate,
            controlChartList: chartData,
            outstandingItems: outs,
            velocity: veloccity,
            avg,
            prList: newAllD.summary,
            // userReviewStats: d.users as IPrUser[]
            userReviewStats: newAllD.users,
            remainingOpenedIssues
        };
        const ccsv = this.generateAllCSV('', allResult);
        fs.writeFileSync(this._config.outputJsonFilename, JSON.stringify(allResult, null, 2), { encoding: 'utf8' }); // done at the end
        this.generateHTML(outs);
        this.addStatsHTML(stats, statsEstimate, veloccity);
        this.addControlChartListHTML(chartData);
        this.writeMoreHTML();
        const fullHTML = `<section>
					<h3>Cool stats</h3>
					${this.getStatsHTML(stats, statsEstimate, veloccity)}
				</section>` +
            `<section>
					<h3>Control chart list</h3>
					${this.generateTableFromCSV(ccsv.csvChart)}
					<div>
						${await this.getControlChartHTML(chartData)}
					</div>
				</section>${this.generateTableFromCSV(ccsv.csvOutstanding)}<section>
					<h3>Velocity list</h3>
					${this.generateTableFromCSV(ccsv.velocityList)}
					<div>
						${await this.getVeloctiyChart(veloccity)}
					</div>
				</section>` +
            `<section>
					<h3>Main list</h3>
					<div style="overflow-x: scroll;">
						${this.generateTableFromCSV(ccsv.mainList)}
					</div>
					<div>
						${await this.getMainChartHTML(avg)}
					</div>
				</section>` +
            `<section>
					<h3>Commits and PRs list</h3>
					${this.generateTableFromCSV(ccsv.csvPrAndCommits)}
					<div>
						${await this.getCommitsChartHTML(allResult.userReviewStats)}
					</div>
				</section>` +
            `<section>
					<h3>Remaining opened issues</h3>
					${this.generateTable(remainingOpenedIssues)}
				</section>` +
            `<section>
					<h3>Remaining opened issues per pipeline</h3>
					${this.generateTable(openedPerPipeline)}
					<div>
						${await this.getOpenedChartHTML(openedPerPipeline, 100)}
					</div>
				</section>`;
        this.updateHTML(path.join(__dirname, 'main_report.html'), path.join(this._mainOutputFolder, 'main_index.html'), '__CONTROL_CHART_TABLE__', fullHTML);
        const mark = models_1.Utils.htmlToMarkdown(fullHTML);
        fs.writeFileSync(path.join(this._mainOutputFolder, 'main_report.md'), mark, { encoding: 'utf8' });
        return Promise.resolve({
            mark,
            allResult
        });
    }
    printRemaining(i, length) {
        const elapsedMs = Date.now() - this._startTimestamp;
        const remainingCount = length - i;
        const timePerIssueMs = elapsedMs / (i + 1);
        this._estimateRemainingPrveiousMs = this._estimateRemainingMs;
        this._estimateRemainingMs = timePerIssueMs * remainingCount;
        const strVal = this._estimateRemainingMs <= this._estimateRemainingPrveiousMs
            ? `${models_1.Utils.millisecondsToHumanReadableTime(this._estimateRemainingMs)}`
            : 'estimating...';
        console.log(`Remaining: ${strVal}`);
    }
    getFromFile() {
        console.log(`Getting from file ${this._file}`);
        if (!FileUtils.fileExists(this._file)) {
            console.log(`File doesn't exist`);
            return null;
        }
        const content = fs.readFileSync(this._file, { encoding: 'utf8' });
        try {
            const obj = JSON.parse(content);
            console.log(`Got existing`);
            if (obj.configHash !== this._configHash) {
                console.log(`Using existing`);
                return null;
            }
            return obj;
        }
        catch (e) {
            return null;
        }
    }
    getControlChartData(issues) {
        const configMaxDate = this._config.maxDate;
        const configMinDate = this._config.minDate;
        const filteered = issues.filter((i) => {
            const endTime = i.completed?.end.getTime();
            return (endTime !== undefined &&
                (configMaxDate === undefined ||
                    endTime <= new Date(configMaxDate).getTime()) &&
                (configMinDate === undefined ||
                    endTime >= new Date(configMinDate).getTime()));
        });
        const tmp = filteered.map((i) => {
            return i.completed?.start
                ? new models_1.ControlChartItem(i.completed?.start, i.completed?.end, i.estimateValue || 0, i.number)
                : null;
        });
        const res = tmp
            .filter((r) => r !== null)
            .map(r => r.toObj());
        res.sort((a, b) => {
            return a.comppleted.getTime() - b.comppleted.getTime();
        });
        return res;
    }
    generateTable(arr) {
        if (arr.length === 0) {
            return '';
        }
        const headers = Object.keys(arr[0]);
        const html = `<table class="table table-striped-columns"><thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${arr
            .slice()
            .map((l) => {
            return `<tr>${Object.keys(l)
                .map(lkey => `<td>${l[lkey]?.toString() || ''}</td>`)
                .join('')}</tr>`;
        })
            .join('')}
                </tbody>
			</table>`;
        return html;
    }
    csvDataToChartItems(csvData) {
        const rows = csvData
            .split('\n')
            .map(row => row.split(','))
            .filter(rowArr => !rowArr.every(value => value === ''))
            .slice(1);
        return rows.map(r => {
            return {
                label: r[0],
                data: Number(r[3])
            };
        });
    }
    addStatsHTML(stats, statsEstimate, veloccity) {
        this._preparedHTML.push(`<div class="stats">
			<h3>Stats</h3>
			<p><b>Average per issue:</b>${stats.average.toFixed(1)}</p>
			<p><b>Median:</b>${stats.median.toFixed(1)}</p>
			<p><b>Average per estimate:</b>${statsEstimate.average.toFixed(1)}</p>
			<p><b>Median per estimate:</b>${statsEstimate.median.toFixed(1)}</p>
			<p><b>Velocity (issue):</b>${veloccity.velocityIssue.toFixed(1)}</p>
			<p><b>Velocity (estimate):</b>${veloccity.velocityEstimate.toFixed(1)}</p>
		</div>`);
    }
    getVelocity(issues) {
        // const completed = 0
        const data = {};
        for (const item of issues) {
            const weekOfMonth = this.getWeekOfMonth(item.comppleted);
            if (!data[weekOfMonth]) {
                data[weekOfMonth] = {
                    estimate: item.estimate,
                    count: 1
                };
            }
            else {
                data[weekOfMonth].estimate += item.estimate;
                data[weekOfMonth].count++;
            }
        }
        const totalCounts = Object.keys(data).reduce((res, item) => {
            const it = data[item];
            res[0] += it.count;
            res[1] += it.estimate;
            // @ts-ignore
            it.key = item;
            res[2].push(it);
            return res;
        }, [0, 0, []]);
        // new Date().getD
        return {
            velocityIssue: totalCounts[0] / Object.keys(data).length,
            velocityEstimate: totalCounts[1] / Object.keys(data).length,
            data: totalCounts[2]
        };
    }
    getWeekOfMonth(date) {
        const firstDayOfMonth = new Date(date.getTime());
        firstDayOfMonth.setDate(1);
        const firstDayOfMonthPosInWeek = firstDayOfMonth.getDay();
        const firstDayOfFirstWeek = models_1.Utils.addDay(firstDayOfMonth, firstDayOfMonthPosInWeek * -1);
        let res = 1;
        while (date.getDate() > models_1.Utils.addDay(firstDayOfFirstWeek, 7 * res).getDate()) {
            ++res;
        }
        return `${date.getMonth()}${res}`;
    }
    mapPipelineConnec(finalRes) {
        return finalRes.pipelinesConnection.nodes.map((pipelineConnectionItem) => {
            const tempRes = Object.assign({}, pipelineConnectionItem);
            tempRes.issues = pipelineConnectionItem.issues.nodes;
            tempRes.issueEndCursor = pipelineConnectionItem.issues.pageInfo
                ?.hasNextPage
                ? pipelineConnectionItem.issues.pageInfo.endCursor
                : undefined;
            finalRes.totalIssues += tempRes.issues.length;
            return tempRes;
        });
    }
    // private findReleaseID(base: IWorkspace): string | undefined {
    // 	for(const pip of base.pipelinesConnection) {
    // 		for(const pipIssue of pip.issues) {
    // 			for(const pipIssue0 of pipIssue.releases.nodes) {
    // 				if(pipIssue0.title === this._config.release) {
    // 					return pipIssue0.id;
    // 				}
    // 			}
    // 		}
    // 	}
    // }
    getAllCSV(report, date) {
        const reportVelocityList = report.velocity.data;
        const csvChart = this.toCSV(report.controlChartList, false, 'Control Chart Items', (delim) => {
            const newObj = Object.assign({}, report.controlChartList[0]);
            newObj.completionTime = Number((report.controlChartList.reduce((res, item) => res + item.completionTime, 0) / report.controlChartList.length).toFixed(0));
            newObj.completionTimeStr = (report.controlChartList.reduce((res, item) => res + Number(item.completionTimeStr), 0) / report.controlChartList.length).toFixed(2);
            newObj.estimate = Number((report.controlChartList.reduce((res, item) => res + item.estimate, 0) / report.controlChartList.length).toFixed(2));
            return `${delim}${delim}${delim}${newObj.completionTime}${delim}${newObj.completionTimeStr}${delim}${newObj.estimate}\n`;
        });
        const csvOutstanding = this.toCSV(report.outstandingItems, false, 'Outstanding issues');
        const velocityList = this.toCSV(report.velocity.data, false, 'Velocity List', (delim) => {
            const newObj = Object.assign({}, reportVelocityList[0]);
            delete newObj.key;
            newObj.estimate = Number((reportVelocityList.reduce((res, item) => res + item.estimate, 0) / reportVelocityList.length).toFixed(2));
            newObj.count = Number((reportVelocityList.reduce((res, item) => res + item.count, 0) / reportVelocityList.length).toFixed(2));
            return `${newObj.estimate}${delim}${newObj.count}\n`;
        });
        const mainList = this.generateMainCSV(report.avg, date, report.statsIssue, report.statsEstimate, report.velocity);
        const userReviewStatsAnon = report.userReviewStats.map((item) => {
            const clone = Object.assign({}, item);
            // clone.user = "user" + index; // TODO uncomment me
            delete clone.shouldReviewCount;
            return clone;
        });
        report.userReviewStats = userReviewStatsAnon;
        const csvPrAndCommits = this.toCSV(userReviewStatsAnon, false, 'PR and commit stats');
        return {
            csvChart,
            csvOutstanding,
            velocityList,
            mainList,
            csvPrAndCommits
        };
    }
    generateTableFromCSV(csvChart) {
        const lines = csvChart
            .trim()
            .split('\n')
            .map(i => i.split(','))
            .filter(e => !!e);
        let title = '';
        if (lines[0].length === 1) {
            title = lines.splice(0, 1)[0][0];
        }
        const [headers] = lines.splice(0, 1);
        if (!headers || headers.length === 0) {
            return '';
        }
        const tableStr = `<table class="table table-striped-columns">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${lines.map(l => `<tr>${l.map(h => `<td>${!isNaN(Number(h)) ? Number(h).toFixed(1) : h}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>`;
        // return `<div> ${title ? `<h3>${title}</h3>` : ""}${tableStr} </div>`;
        return tableStr;
    }
    async getVeloctiyChart(data0) {
        // console.log(data);
        const data = data0.data.filter(r => r.key);
        const labels = data.map(d => d.key || '');
        const values = data.map(d => {
            return {
                x: (Number(d.key) || 0) * 7 * 24 * 3600000, // in ms
                y: d.count,
                r: d.estimate
            };
        });
        const file = path.join(this._mainOutputFolder, 'velocity_stuff.png');
        const title = 'Velocity graph';
        const b64img = await chart_helper_1.ChartHelper.generateScatterChart(title, values, labels, file, 5);
        // return Promise.resolve(`<img title="${title}" src="${file.replace(/output./, "")}">`);
        return Promise.resolve(`<img title="${title}" src="data:image/png;base64,${b64img}">`);
    }
    async getControlChartHTML(data0) {
        // console.log(data);
        const data = data0.slice();
        // data.sort((a: IControlChartItem, b: IControlChartItem) => {
        // 	return a.comppleted.getTime() - b.comppleted.getTime();
        // })
        const labels = data.map(d => d.comppleted.toLocaleDateString());
        const values = data.map(d => {
            return {
                x: d.comppleted.getTime(),
                y: Number(d.completionTimeStr),
                r: d.estimate
            };
        });
        const file = path.join(this._mainOutputFolder, 'bubble_stuff.png');
        const title = 'My Title';
        const b64img = await chart_helper_1.ChartHelper.generateScatterChart(title, values, labels, file, this._bubbleBaseWith);
        // return Promise.resolve(`<img title="${title}" src="${file.replace(/output./, "")}">`);
        return Promise.resolve(`<img title="${title}" src="data:image/png;base64,${b64img}">`);
        // const imgFiles = [
        //
        // 		path: path.join(this._mainOutputFolder, "issueCount.png"),
        // 		title: "Total issues per pipeline",
        // 		key: "issueCount",
        // 		labelKey: "pipeline"
        // 	},
        // 	{
        // 		path: path.join(this._mainOutputFolder, "duration.png"),
        // 		title: "Days per pipeline",
        // 		key: "duration",
        // 		labelKey: "pipeline"
        // 	}
        // ];
        //
        // return this.generateChartFromArray(imgFiles, dataq, 50);
    }
    async getMainChartHTML(csvPrAndCommits) {
        console.log(csvPrAndCommits);
        const pipelines = Object.keys(csvPrAndCommits);
        const dataq = pipelines.map((pipeline) => {
            const item = csvPrAndCommits[pipeline];
            return {
                pipeline,
                issueCount: item.issueCount,
                duration: item.data.durationDays
            };
        });
        const imgFiles = [
            {
                path: path.join(this._mainOutputFolder, 'issueCount.png'),
                title: 'Total issues per pipeline',
                key: 'issueCount',
                labelKey: 'pipeline'
            },
            {
                path: path.join(this._mainOutputFolder, 'duration.png'),
                title: 'Days per pipeline',
                key: 'duration',
                labelKey: 'pipeline'
            }
        ];
        return this.generateChartFromArray(imgFiles, dataq, 50);
    }
    async getOpenedChartHTML(csvPrAndCommits, chartSizePerc = 50) {
        const imgFiles = [
            {
                path: path.join(this._mainOutputFolder, 'remainingissueCount.png'),
                title: 'Remaining opened issues per pipeline',
                key: 'opened',
                labelKey: 'pipeline'
            }
        ];
        return this.generateChartFromArray(imgFiles, csvPrAndCommits, chartSizePerc);
    }
    async getCommitsChartHTML(csvPrAndCommits) {
        const imgFiles = [
            {
                path: path.join(this._mainOutputFolder, 'prCommitCreated.png'),
                title: 'Repartition of PR creation',
                key: 'created',
                labelKey: 'user'
            },
            {
                path: path.join(this._mainOutputFolder, 'prCommitReviewed.png'),
                title: 'Repartition of PR reviews',
                key: 'didReviewCount',
                labelKey: 'user'
            },
            {
                path: path.join(this._mainOutputFolder, 'prCommitCommited.png'),
                title: 'Repartition of commits',
                key: 'totalCommits',
                labelKey: 'user'
            }
        ];
        return this.generateChartFromArray(imgFiles, csvPrAndCommits, 33);
    }
    async getChartGeneric(title, outputFile, csvPrAndCommits, key, labelKey) {
        // await this.generateChartFromObj("", evs, `output_issue_${issueNumber}.png`, {width: 1600, height: 1200});
        const items = csvPrAndCommits.map(c => {
            return {
                label: labelKey === undefined ? '' : c[labelKey],
                data: c[key]
            };
        });
        return chart_helper_1.ChartHelper.generateChartFromObj(title, items, outputFile, {
            width: 1600,
            height: 1200
        });
    }
    async generateChartFromArray(imgFiles, dataq, sizePerc) {
        if (sizePerc < 0) {
            sizePerc *= 100;
        }
        const res = [];
        for (const dat of imgFiles) {
            const b64img = await this.getChartGeneric(dat.title, dat.path, dataq, dat.key, dat.labelKey);
            res.push(`<!--<img style="width: ${sizePerc}%" title="${dat.title}" src="${dat.path.replace(/output./, '')}">-->`);
            // const b64img: string = fs.readFileSync(dat.path, { encoding: "base64" });
            res.push(`<img style="width: ${sizePerc}%" title="${dat.title}" src="data:image/png;base64,${b64img}">`);
        }
        return res.join('');
    }
    averageOBjects(objects, includeKeys) {
        const result = {};
        objects.forEach((obj) => {
            Object.keys(obj).forEach(key => {
                if (Array.isArray(obj[key])) {
                    result[key] = this.averageOBjects(obj[key], includeKeys);
                }
                else if (result[key] === undefined) {
                    result[key] = obj[key];
                }
                else {
                    if (typeof obj[key] === 'number') {
                        result[key] += obj[key];
                    }
                }
            });
        });
        Object.keys(result).forEach(key => {
            if (typeof result[key] === 'number' && includeKeys.includes(key)) {
                result[key] /= objects.length;
            }
        });
        return result;
    }
    getStatsHTML(stats, statsEstimate, veloccity) {
        return `<table>
			<thead><tr><th></th><th></th></tr></thead>
			<tbody>
				<tr>
					<td>Velocity: </td>
					<td>${veloccity.velocityIssue}</td>
				</tr>
				<tr>
					<td>Velocity estimate: </td>
					<td>${veloccity.velocityEstimate.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Average day per issue: </td>
					<td>${stats.average.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Median day per issue: </td>
					<td>${stats.median}</td>
				</tr>
				<tr>
					<td>Average day per estimate: </td>
					<td>${statsEstimate.average.toFixed(2)}</td>
				</tr>
				<tr>
					<td>Median day per estimate: </td>
					<td>${statsEstimate.median}</td>
				</tr>
			</tbody>
		</table>`;
    }
    averageUsers(users) {
        const uu = users.reduce((res, us) => {
            // const others = all.filter(a => a.user === us.user);
            // return  {
            // 	user:
            // } as IPrUser;
            const existing = res.find(a => a.user === us.user);
            if (!existing) {
                res.push(Object.assign({}, us));
            }
            else {
                existing.created += us.created;
                existing.shouldReviewCount += us.shouldReviewCount;
                existing.didReviewCount += us.didReviewCount;
                existing.totalCommits += us.totalCommits;
                existing.totalCommitsPerWeek += us.totalCommitsPerWeek;
            }
            return res;
        }, []);
        const totalCreated = uu.reduce((res, it) => res + it.created, 0);
        uu.forEach((u) => {
            const othersCreated = totalCreated - u.created;
            u.createdPerc = Number((u.created / totalCreated).toFixed(2));
            u.reviewedPerc = Number((u.didReviewCount / othersCreated).toFixed(2));
        });
        return uu;
    }
    async getGithubData(repos) {
        const allD = [];
        for (const repo of repos) {
            const d = (await reviewer_call
                .check_prs(repo, this._config)
                .catch((err) => {
                console.error(err.message);
                return {
                    summary: [],
                    users: []
                };
            }));
            allD.push(d);
        }
        // @ts-ignore
        const prUsers = [].concat(
        // @ts-ignore
        ...allD.map((ad) => ad.users));
        // @ts-ignore
        const users = Array.from(new Set([].concat(
        // @ts-ignore
        ...allD.map((f) => f.users.map((au) => au.user)))));
        const usersAvg = users.reduce((res, us) => {
            // @ts-ignore
            const prUs = prUsers.filter((u) => u.user === us);
            const av = this.averageOBjects(prUs, [
                'reviewedPerc',
                'createdPerc'
            ]);
            // const avz: IPrUser[] = this.averageUsers(prUs);
            // const av: IPrUser = avz[0];
            // console.log(av);
            res.users.push(av);
            const sbumaroes = []
                // @ts-ignore
                .concat(...allD.map(a => a.summary))
                .filter((u) => u.author === us);
            res.summary.push(...sbumaroes);
            return res;
        }, { users: [], summary: [] });
        const newAllD = Object.assign({}, allD[0]);
        // newAllD.users = usersAvg.users;
        newAllD.users = this.averageUsers(usersAvg.users);
        newAllD.summary = usersAvg.summary;
        // TODO year commit
        // const d: ICheckPr = newAllD;
        //
        // // const tb = this.averageOBjects(d.users, ["reviewedPerc", "createdPerc"]);
        // const dUsers: IPrUser[] = this.averageUsers(d.users);
        return Promise.resolve({ allD, newAllD });
    }
}
exports.Program = Program;
//# sourceMappingURL=zenhub_call.js.map