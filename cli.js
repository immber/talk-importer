#!/usr/bin/env node

const h = require('highland');
const fs = require('fs');
const resolve = require('resolve');
const yargs = require('yargs');
const path = require('path');
const { get } = require('lodash');
const { readFile } = require('./services/fs');
const { parseJSONStream, save } = require('./services/pipelines');

/**
 * Describe all the available importing strategies.
 */
const strategies = fs.readdirSync(path.resolve(__dirname, 'strategies')).sort();

/**
 * Log a quick error message
 * @param  {String} message
 */
const logError = ({ id, message }) => {
  console.log(
    JSON.stringify({
      status: 'error',
      id,
      message,
    })
  );
};

/**
 * Log a success.
 */
const logSuccess = ({ id }) => {
  console.log(
    JSON.stringify({
      status: 'success',
      id,
    })
  );
};

/**
 * execute will perform the reading, translation, saving, and logging of the
 * entity import.
 *
 * @param {String} importer the command being executed
 * @param {Object} argv arguments from yargs
 */
const execute = (
  importer,
  { file, strategy: strategyName, concurrency, validate }
) => {
  let modulePath;
  try {
    modulePath = resolve.sync(`./strategies/${strategyName}/${importer}`, {
      basedir: __dirname,
    });
  } catch (err) {
    throw new Error(
      `${importer} importer not found for ${strategyName} strategy`
    );
  }

  // Load the strategy to perform the import.
  const strategy = require(modulePath);

  const readPipe = get(strategy, 'read', readFile);

  // Create the pipes we'll use to parse the data.
  const parsePipe = get(strategy, 'parse', parseJSONStream);

  // Create a pipe to run data validation first
  const validatePipe = get(strategy, 'validate');

  // Create the pipe we'll use to translate the data to the saving format.
  const translatePipe = get(strategy, 'translate');
  if (!translatePipe) {
    throw new Error(
      `translation not available for the ${strategyName} ${importer} strategy`
    );
  }

  // Select the correct saving method based on the command used.
  const savePipe = save[importer];

  if (validate) {
    if (!validatePipe) {
      throw new Error(
        `validation not available for the ${strategyName} ${importer} strategy`
      );
    }
    return h
      .of(file)
      .flatMap(readPipe)
      .pipe(parsePipe)
      .map(validatePipe)
      .parallel(concurrency)
      .errors(logError)
      .each(logSuccess)
      .done(process.exit);
  } else {
    return h
      .of(file)
      .flatMap(readPipe)
      .pipe(parsePipe)
      .map(translatePipe)
      .parallel(concurrency)
      .map(savePipe)
      .parallel(concurrency)
      .errors(logError)
      .each(logSuccess)
      .done(process.exit);
  }
};

/**
 * Describe the options and requirements for those.
 */
yargs
  .option('strategy', {
    alias: 's',
    describe: 'Strategy to import the comments with',
    choices: strategies.sort(),
  })
  .option('concurrency', {
    alias: 'c',
    describe: 'Concurrency of the importer',
    default: 10,
  })
  .option('validate', {
    alias: 'v',
    describe: 'Validate source data without importing',
    default: false,
  })
  .demandOption(
    ['strategy'],
    'Please provide the strategy to work with this tool'
  );

/**
 * Map all the types of importers available.
 */
['assets', 'comments', 'users'].forEach(importer => {
  yargs.command(
    `${importer} <file> [options]`,
    `Import ${importer} from the specified export`,
    yargs => {
      yargs.positional('file', {
        describe: `file containing exported ${importer}`,
        type: 'string',
        coerce: path.resolve,
      });
    },
    argv => execute(importer, argv)
  );
});

/**
 * Require at least one command to run.
 */
yargs
  .demandCommand(
    1,
    'Please run one of the above mentioned commands to perform the import'
  )
  .help().argv;
