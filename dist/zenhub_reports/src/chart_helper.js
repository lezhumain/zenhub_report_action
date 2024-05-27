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
exports.ChartHelper = void 0;
const fs = __importStar(require("fs"));
const chartjs_node_canvas_1 = require("chartjs-node-canvas");
const models_1 = require("./models");
class ChartHelper {
    static _colorCache = {};
    static _chartCallback = (ChartJS) => {
        const obj = { responsive: true, maintainAspectRatio: false };
        if (ChartJS.defaults.global === undefined) {
            ChartJS.defaults.global = obj;
        }
        else {
            Object.assign(ChartJS.defaults.global, obj);
        }
    };
    static _chartOptions = {
        width: 1600,
        height: 1200,
        chartCallback: ChartHelper._chartCallback
    };
    static _chartConfig = {
        type: '',
        data: {
            labels: [],
            datasets: [
                {
                    label: '',
                    data: [],
                    backgroundColor: ''
                }
            ]
        },
        plugins: [
            {
                id: 'background-colour',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.fillStyle = 'lightgrey';
                    ctx.fillRect(0, 0, ChartHelper._chartOptions.width, ChartHelper._chartOptions.height);
                    ctx.restore();
                }
            }
        ],
        options: {
            plugins: {
                title: {
                    display: true,
                    text: ''
                }
            }
        }
    };
    static getCanv(chartOptions) {
        return new chartjs_node_canvas_1.ChartJSNodeCanvas(chartOptions || ChartHelper._chartOptions);
    }
    /**
     * Generate chart image file from list
     * @param title
     * @param chartItems
     * @param outputFile
     * @param sizeObj
     */
    static async generateChartFromObj(title, chartItems, outputFile, sizeObj) {
        // throw new Error("STOP!");
        const data0 = chartItems.map(e => e.data);
        const sum = data0.reduce((res, item) => res + item, 0);
        const labels = chartItems.map(e => `${e.label} (${((e.data * 100) / sum).toFixed(1)}%)`);
        return ChartHelper.generateChart(title, data0, labels, outputFile, sizeObj);
    }
    /**
     * Generate chart image file from data and label list
     * @param title
     * @param dataList
     * @param labelList
     * @param outputFile
     * @param sizeObj
     */
    static async generateChart(title, dataList, labelList, outputFile, sizeObj) {
        // Create a new instance of ChartJSNodeCanvas
        // const chartCallback = (ChartJS: any) => {
        // 	const obj = { responsive: true, maintainAspectRatio: false };
        // 	if (ChartJS.defaults.global === undefined) {
        // 		ChartJS.defaults.global = obj;
        // 	} else {
        // 		Object.assign(ChartJS.defaults.global, obj);
        // 	}
        // };
        // const chartOptions: ChartJSNodeCanvasOptions = { ...sizeObj, chartCallback };
        return this.doGenerate(title, ChartHelper._chartOptions, labelList, dataList, outputFile);
    }
    static getColors(dataList) {
        // @ts-ignore
        return dataList.map(pKey => {
            const d = pKey.replace(/ \(\d+(\.\d+)?%\)$/g, '');
            let cached = this._colorCache[d];
            if (!cached) {
                this._colorCache[d] = this.getRandomColor();
                cached = this._colorCache[d];
            }
            return cached;
        });
    }
    static getRandomColor() {
        const randomNumber = Math.floor(Math.random() * 16777215); // Generates a random number up to FFFFFF in hexadecimal
        const hexNumber = randomNumber.toString(16); // Convert the random number to hexadecimal
        return `#${hexNumber}`;
    }
    static async generateScatterChart(myTitle, values, labels, outputFile, bubbleBaseWith = 3) {
        // const chartCallback = (ChartJS: any) => {
        // 	const obj = { responsive: true, maintainAspectRatio: false };
        // 	if (ChartJS.defaults.global === undefined) {
        // 		ChartJS.defaults.global = obj;
        // 	} else {
        // 		Object.assign(ChartJS.defaults.global, obj);
        // 	}
        // };
        //
        // const chartOptions: ChartJSNodeCanvasOptions = { width: 1600, height: 1200, chartCallback };
        // const chartJSNodeCanvas = new ChartJSNodeCanvas(chartOptions);
        const bubbleValues = values;
        const xData = Array.from(new Set(bubbleValues.map(b => Math.trunc(models_1.Utils.getMsAsDays(b.x)))));
        const lineData = xData.reduce((res, xValue) => {
            const allSameX = bubbleValues.filter(d => Math.trunc(models_1.Utils.getMsAsDays(d.x)) === xValue);
            res.push({
                x: models_1.Utils.getDaysAsMs(xValue),
                y: allSameX.reduce((res, item) => res + item.y, 0),
                r: allSameX.reduce((res, item) => res + item.r, 0)
            });
            return res;
        }, []);
        const lineDataEstimate = lineData.map(e => {
            return {
                x: e.x,
                y: e.r
            };
        });
        bubbleValues.forEach((v) => {
            v.r = v.r * bubbleBaseWith;
        });
        const data = Object.assign({}, ChartHelper._chartConfig);
        data.type = 'bubble';
        data.data.labels = labels;
        data.data.datasets = [
            {
                label: 'My First Dataset',
                data: bubbleValues,
                backgroundColor: this.getBubbleColors(values),
                // backgroundColor: this.getColors(bubbleValues.map(v => v.x.toString())),
                order: 3
            },
            {
                label: 'Completion time each day',
                data: lineData,
                type: 'line',
                order: 2,
                borderColor: 'blue'
            },
            {
                label: 'Completed estimates each day',
                data: lineDataEstimate,
                type: 'line',
                order: 1, // this dataset is drawn on top
                borderColor: 'orange'
            }
        ];
        data.options = {
            plugins: {
                title: {
                    display: true,
                    text: myTitle
                }
            }
        };
        const chartJSNodeCanvas = ChartHelper.getCanv();
        // Define chart data
        // const data: ChartConfiguration = {
        // 	type: "bubble",
        // 	data: {
        // 		labels: labels,
        // 		datasets: [
        // 			{
        // 				label: 'My First Dataset',
        // 				data: bubbleValues,
        // 				// backgroundColor: this.getBubbleColors(values as any[]),
        // 				backgroundColor: this.getColors(bubbleValues.map(v => v.x.toString())),
        // 				order: 1 // this dataset is drawn on top
        // 			},
        // 			{
        // 				label: 'Completion time each day',
        // 				data: lineData,
        // 				type: 'line',
        // 				order: 2,
        // 				borderColor: "blue"
        // 			},
        // 			{
        // 				label: 'Completed estimates each day',
        // 				data: lineDataEstimate,
        // 				type: 'line',
        // 				order: 3,
        // 				borderColor: "orange"
        // 			}
        // 		]
        // 	},
        // 	plugins: [
        // 		{
        // 			id: 'background-colour',
        // 			beforeDraw: (chart: any) => {
        // 				const ctx = chart.ctx;
        // 				ctx.save();
        // 				ctx.fillStyle = 'lightgrey';
        // 				ctx.fillRect(0, 0, chartOptions.width, chartOptions.height);
        // 				ctx.restore();
        // 			}
        // 		}
        // 	],
        // 	options: {
        // 		plugins: {
        // 			title: {
        // 				display: true,
        // 				text: myTitle
        // 			}
        // 		}
        // 	}
        // };
        const buffer = await chartJSNodeCanvas.renderToBuffer(data);
        fs.writeFileSync(outputFile, buffer, 'base64');
        return Promise.resolve(buffer.toString('base64'));
    }
    static async doGenerate(title, chartOptions, labelList, dataList, outputFile) {
        const chartJSNodeCanvas = ChartHelper.getCanv(ChartHelper._chartOptions);
        const conf = Object.assign({}, ChartHelper._chartConfig);
        conf.type = 'polarArea';
        conf.data.labels = labelList;
        conf.data.datasets[0].data = dataList;
        conf.data.datasets[0].backgroundColor = ChartHelper.getColors(labelList);
        conf.options = {
            plugins: {
                title: {
                    display: true,
                    text: title
                }
            }
        };
        // Define chart data
        const buffer = await chartJSNodeCanvas.renderToBuffer(conf);
        fs.writeFileSync(outputFile, buffer, 'base64');
        return Promise.resolve(buffer.toString('base64'));
    }
    static interpolateColor(fromColor, toColor, weight) {
        const r = Math.round(fromColor[0] * (1 - weight) + toColor[0] * weight);
        const g = Math.round(fromColor[1] * (1 - weight) + toColor[1] * weight);
        const b = Math.round(fromColor[2] * (1 - weight) + toColor[2] * weight);
        return `rgb(${r}, ${g}, ${b})`;
    }
    static getBubbleColors(values) {
        const max = Math.max(...values.map(v => v.r));
        // const max = 13;
        const green = [0, 255, 0];
        const red = [255, 0, 0];
        return values.map(v => ChartHelper.interpolateColor(green, red, Math.trunc(v.r / max)));
    }
}
exports.ChartHelper = ChartHelper;
//# sourceMappingURL=chart_helper.js.map