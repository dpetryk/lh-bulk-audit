#!/usr/bin/env node

const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");
const { red, yellow, green, italic, bold } = require("colors/safe");
const path = require("path");
const fs = require("fs");
const assetSaver = require("lighthouse/lighthouse-core/lib/asset-saver");
const commander = require("commander");
const computeGmean = require("compute-gmean");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const urlsToCheck = require("./urls-to-check");
const moment = require("moment-timezone");

const lighthouseConfig = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance"],
    throttlingMethod: "devtools",
  },
};

const GMEAN_PREFIX = "GMEAN: ";

const storedLogs = path.resolve(process.cwd(), "storedLogs");
fs.mkdirSync(storedLogs, { recursive: true });

const csvWriter = createCsvWriter({
  path: `${storedLogs}/logged-results.csv`,
  header: [
    { id: "site", title: "SITE URL" },
    { id: "type", title: "TYPE" },
    { id: "p", title: "PERFORMANCE SCORE" },
    { id: "fcp", title: "FIRST CONTENTFUL PAINT" },
    { id: "fmp", title: "FIRST MEANINGFUL PAINT" },
    { id: "speed", title: "SPEED INDEX" },
    { id: "cpu", title: "FIRST CPU IDLE" },
    { id: "tti", title: "TIME TO INTERACTIVE" },
    { id: "size", title: "TOTAL BYTE WEIGHT" },
  ],
});

async function runLighthouse(lighthouseUrl, storeLogs) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
  const port = chrome.port;
  const results = await lighthouse(
    lighthouseUrl,
    { port },
    lighthouseConfig
  ).catch(error => console.log(error));
  if (results) {
    const condensedReport = condenseReport(results.lhr);
    addToLogs(condensedReport, lighthouseUrl, "PARTIAL");
    console.log(
      `${GMEAN_PREFIX.replace(/./g, " ")}${oneliner(
        condensedReport,
        lighthouseUrl
      )}`
    );

    if (storeLogs) {
      const pathWithBasename = path.resolve(
        storedLogs,
        `${results.artifacts.BenchmarkIndex}`
      );
      await assetSaver.saveAssets(
        results.artifacts,
        results.lhr.audits,
        pathWithBasename
      );
    }

    await chrome.kill();
    return condensedReport;
  } else {
    logError(lighthouseUrl);
    await chrome.kill();
    return null;
  }
}

// See [1] for important metrics
// [1] https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/config/default-config.js#L323-L327
function condenseReport(results) {
  return {
    performanceScore: results.categories.performance.score,
    firstContentfulPaint: results.audits["first-contentful-paint"].numericValue,
    firstContentfulPaintScore: results.audits["first-contentful-paint"].score,
    firstMeaningfulPaint: results.audits["first-meaningful-paint"].numericValue,
    firstMeaningfulPaintScore: results.audits["first-meaningful-paint"].score,
    speedIndex: results.audits["speed-index"].numericValue,
    speedIndexScore: results.audits["speed-index"].score,
    timeToInteractive: results.audits["interactive"].numericValue,
    timeToInteractiveScore: results.audits["interactive"].score,
    firstCpuIdle: results.audits["first-cpu-idle"].numericValue,
    firstCpuIdleScore: results.audits["first-cpu-idle"].score,
    totalByteWeight: results.audits["total-byte-weight"].numericValue,
  };
}

function oneliner(r, url) {
  return [
    `${italic(url)}`,
    `${italic("p:")} ${formatScore(r.performanceScore)}`,
    `${italic("fcp:")} ${formatAudit(r, "firstContentfulPaint", 3 / 15)}`,
    `${italic("fmp:")} ${formatAudit(r, "firstMeaningfulPaint", 1 / 15)}`,
    `${italic("speed:")} ${formatAudit(r, "speedIndex", 4 / 15)}`,
    `${italic("cpu:")} ${formatAudit(r, "firstCpuIdle", 2 / 15)}`,
    `${italic("tti:")} ${formatAudit(r, "timeToInteractive", 5 / 15)}`,
    `${italic("size:")} ${formatBytes(r.totalByteWeight)}`,
  ].join(", ");
}

async function addToLogs(r, url, type) {
  await csvWriter.writeRecords([
    {
      site: url,
      type: type,
      p: formatScore(r.performanceScore, false),
      fcp: formatAudit(r, "firstContentfulPaint", 3 / 15, false),
      fmp: formatAudit(r, "firstMeaningfulPaint", 1 / 15, false),
      speed: formatAudit(r, "speedIndex", 4 / 15, false),
      cpu: formatAudit(r, "firstCpuIdle", 2 / 15, false),
      tti: formatAudit(r, "timeToInteractive", 5 / 15, false),
      size: formatBytes(r.totalByteWeight),
    },
  ]);
}

async function logError(url) {
  await csvWriter
    .writeRecords([
      {
        site: url,
        type: "Error: site not loaded",
      },
    ])
    .then(() => {
      console.log("Logged error", formatScore(r.performanceScore, false));
    });
}

function formatScore(score, colorize = true) {
  const number = `${Math.floor(score * 100)}`;
  if (colorize) {
    return colorizeByScore(number.padStart(3), score);
  }
  return number.padStart(3);
}

function formatAudit(results, auditName, weight, colorize = true) {
  const auditScore = results[`${auditName}Score`];
  const text = `${formatDuration(results[auditName])} (${formatWeightedScore(
    auditScore,
    weight
  )})`;

  if (colorize) {
    return colorizeByScore(text, auditScore);
  }
  return text;
}

function colorizeByScore(text, score) {
  if (score > 0.89) {
    return green(text);
  } else if (score > 0.49) {
    return yellow(text);
  }
  return red(text);
}

function formatDuration(durationInMs) {
  const seconds = durationInMs / 1000;
  return `${seconds.toFixed(2)} s`;
}

function formatWeightedScore(score, weight) {
  const weightedScore = score * weight;
  return `${formatWeight(weightedScore)}/${formatWeight(weight)}`;
}

function formatWeight(weight) {
  return (weight * 100).toFixed(1);
}

function formatBytes(bytes) {
  const kiloBytes = Math.round(bytes / 1000);
  const thousand = Math.floor(kiloBytes / 1000);
  const hundred = `${kiloBytes % 1000}`;
  if (thousand) {
    return `${thousand},${hundred.padStart(3, "0")} KB`;
  }
  return `${hundred} KB`;
}

async function multipleTimes(url, storeLogs) {
  const multipleResults = [];

  for (const j of new Array(3)) {
    const result = await runLighthouse(url, storeLogs);
    if (result) {
      multipleResults.push(result);
    }
  }

  if (multipleResults.length > 0) {
    const gmean = {};
    Object.keys(multipleResults[0]).forEach(metric => {
      const valuesOfMetric = multipleResults.map(r => r[metric]);
      gmean[metric] = computeGmean(valuesOfMetric);
    });

    console.log(`${bold(GMEAN_PREFIX)}${oneliner(gmean, url)}`);
    addToLogs(gmean, url, "GMEAN");
  }
}

function checkTime() {
  const date = moment().tz("Australia/Sydney");
  const hour = parseInt(date.format("H"));
  const weekday = date.weekday();

  return (
    hour >= 9 && hour <= 18 && weekday !== 0 && weekday !== 6
  );
}

async function doScript(startPoint, cmd) {
  for (let i = startPoint; i < urlsToCheck.length; i++) {
    if (checkTime()) {
      console.log("It's a great time to run the script");
      await multipleTimes(urlsToCheck[i], cmd.storeLogs);
    } else {
      console.log("Terrible time to run the script");
      pauseScript(i, cmd);
      break;
    }
  }
}

function pauseScript(pausePoint, cmd) {
  let interval;
  interval = setInterval(() => {
    if (checkTime()) {
      clearInterval(interval);
      console.log("script resumed at: ", pausePoint);
      doScript(pausePoint, cmd);
    }
  }, 60000);
}

commander
  .description("Runs lighthouse performance tests")
  .usage("[options]")
  .option("-s, --store-logs", "store lighthouse logs in ./storedLogs")
  .action(async cmd => {
    if (!cmd) {
      commander.outputHelp();
      process.exitCode = 1;
      return;
    }
    doScript(0, cmd);
  })
  .parse(process.argv);
