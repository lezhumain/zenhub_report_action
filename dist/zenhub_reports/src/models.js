"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatHelper = exports.ControlChartItem = exports.Utils = void 0;
const node_html_markdown_1 = require("node-html-markdown");
class Utils {
    static millisecondsToHumanReadableTime(milliseconds) {
        const seconds = Math.floor((milliseconds / 1000) % 60);
        const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
        const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
        const days = Math.floor((milliseconds / (1000 * 60 * 60 * 24)) % 30);
        const weeks = Math.floor((milliseconds / (1000 * 60 * 60 * 24 * 7)) % 4);
        const months = Math.floor(milliseconds / (1000 * 60 * 60 * 24 * 30));
        const monthsStr = months > 0 ? months + 'm ' : '';
        const weeksStr = weeks > 0 ? weeks + 'w ' : '';
        const daysStr = days > 0 ? days + 'd ' : '';
        const hoursStr = hours < 10 ? '0' + hours : hours;
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        const secondsStr = seconds < 10 ? '0' + seconds : seconds;
        return `${monthsStr}${weeksStr}${daysStr}${hoursStr}:${minutesStr}:${secondsStr}`;
    }
    static addDay(firstDayOfMonth, number) {
        const epoch = firstDayOfMonth.getTime();
        return new Date(epoch + number * 24 * 60 * 60 * 1000);
    }
    static getMsAsDays(duration) {
        return duration / 1000 / 60 / 60 / 24;
    }
    static getDaysAsMs(duration) {
        return duration * 1000 * 60 * 60 * 24;
    }
    static htmlToMarkdown(fullHTML) {
        const mark = node_html_markdown_1.NodeHtmlMarkdown.translate(
        /* html */ fullHTML, 
        /* options (optional) */ {}, 
        /* customTranslators (optional) */ undefined, 
        /* customCodeBlockTranslators (optional) */ undefined);
        return mark;
    }
}
exports.Utils = Utils;
class ControlChartItem {
    _number;
    _started;
    _comppleted;
    _estimate;
    get started() {
        return this._started;
    }
    get comppleted() {
        return this._comppleted;
    }
    get estimate() {
        return this._estimate;
    }
    get completionTime() {
        return this._comppleted.getTime() - this._started.getTime();
    }
    get completionTimeStr() {
        // return Utils.millisecondsToHumanReadableTime(this.completionTime);
        return (this.completionTime / 1000 / 60 / 60 / 24).toFixed(0);
    }
    get number() {
        return this._number;
    }
    // constructor(started: number, comppleted: number, estimate: number) {
    // 	this._started = started;
    // 	this._comppleted = comppleted;
    // 	this._estimate = estimate;
    // }
    constructor(started, comppleted, estimate, _number) {
        this._number = _number;
        this._started = started;
        this._comppleted = comppleted;
        this._estimate = estimate;
    }
    toObj() {
        return {
            number: this._number,
            started: this._started,
            comppleted: this._comppleted,
            completionTime: this.completionTime,
            completionTimeStr: this.completionTimeStr,
            estimate: this._estimate
        };
    }
}
exports.ControlChartItem = ControlChartItem;
class StatHelper {
    static getMedian(arr) {
        const middle = (arr.length + 1) / 2;
        const sorted = [...arr].sort((a, b) => a - b);
        const isEven = sorted.length % 2 === 0;
        return isEven
            ? (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2
            : sorted[middle - 1];
    }
    static getAverage(arr) {
        return arr.reduce((res, val) => res + val, 0) / arr.length;
    }
    static getStats(arr) {
        return {
            average: StatHelper.getAverage(arr),
            median: StatHelper.getMedian(arr)
        };
    }
}
exports.StatHelper = StatHelper;
//# sourceMappingURL=models.js.map