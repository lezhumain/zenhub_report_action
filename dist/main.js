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
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const zenhub_call_1 = require("./zenhub_reports/src/zenhub_call");
const fs = __importStar(require("node:fs"));
const current = new Date();
const minus1month = new Date(current);
minus1month.setMonth(minus1month.getMonth() - 1);
const workspaceId = process.env.WORKSPACE_ID || core.getInput('WORKSPACE_ID');
if (!workspaceId || !process.env.REPO_ID) {
    console.error('Need to export WORKSPACE_ID and REPO_ID');
    process.exit(1);
}
const config = {
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
};
/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
    try {
        const program = new zenhub_call_1.Program(config);
        // skip ReBrowse
        program
            .main((issue) => {
            const matchesLabel = config.labels !== undefined &&
                config.labels.some(l => {
                    const low = l.toLowerCase();
                    return (issue.labels !== undefined &&
                        issue.labels.map(la => la.toLowerCase()).includes(low));
                });
            const idShouldSkip = !!config.issuesToSkip?.includes(issue.number);
            const skip = !matchesLabel && idShouldSkip;
            return Promise.resolve(skip);
        }, (event) => {
            if (!config.minDate || !config.maxDate) {
                return Promise.resolve(false);
            }
            const minDate = new Date(config.minDate);
            const maxDate = new Date(config.maxDate);
            const eventDate = new Date(event.createdAt);
            const skip = (minDate !== undefined &&
                eventDate.getTime() < minDate.getTime()) ||
                (maxDate !== undefined && eventDate.getTime() > maxDate.getTime());
            return Promise.resolve(skip);
        })
            .then((res) => {
            const file = 'zenhub_report.md';
            fs.writeFileSync(file, res.mark, { encoding: 'utf8' });
            core.setOutput('markdownContent', res.mark);
            // core.setOutput('markdownFile', file);
            // console.log('markdownContent', res.mark)
        });
    }
    catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) {
            core.setFailed(error.message);
            // console.log(error.message)
        }
    }
}
exports.run = run;
//# sourceMappingURL=main.js.map