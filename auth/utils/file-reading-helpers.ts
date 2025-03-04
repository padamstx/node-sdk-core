/**
 * Copyright 2021 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { parse } from 'dotenv';
import { existsSync, readFileSync, lstatSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import logger from '../../lib/logger';

// Putting all file-reading related code in this file to isolate the usage of the
// `fs` module, as it causes problems in browser environments.

const defaultCredsFilename: string = 'ibm-credentials.env';

/**
 * Return a config object based on a credentials file. Credentials files can
 * be specified filepath via the environment variable: `IBM_CREDENTIALS_FILE`.
 */
export function readCredentialsFile() {
  if (!existsSync) {
    return {};
  }

  // first look for an env variable called IBM_CREDENTIALS_FILE
  // it should be the path to the file

  // then look at the current working directory
  // then at the os-dependent home directory

  const givenFilepath: string = process.env.IBM_CREDENTIALS_FILE || '';
  const workingDir: string = constructFilepath(process.cwd());
  const homeDir: string = constructFilepath(homedir());

  let filepathToUse: string;

  if (givenFilepath) {
    if (fileExistsAtPath(givenFilepath)) {
      // see if user gave a path to a file named something other than `ibm-credentials.env`
      filepathToUse = givenFilepath;
    } else if (fileExistsAtPath(constructFilepath(givenFilepath))) {
      // see if user gave a path to the directory where file is located
      filepathToUse = constructFilepath(givenFilepath);
    }
  } else if (fileExistsAtPath(workingDir)) {
    filepathToUse = workingDir;
  } else if (fileExistsAtPath(homeDir)) {
    filepathToUse = homeDir;
  } else {
    // file does not exist anywhere, will not be used
    logger.info('Credential file does not exist. Will not be used');
    return {};
  }

  const credsFile = readFileSync(filepathToUse);

  return parse(credsFile);
}

export function fileExistsAtPath(filepath: string): boolean {
  if (existsSync(filepath)) {
    const stats = lstatSync(filepath);
    return stats.isFile() || stats.isSymbolicLink();
  }

  return false;
}

export function constructFilepath(filepath: string): string {
  // ensure filepath includes the filename
  if (!filepath.endsWith(defaultCredsFilename)) {
    filepath = join(filepath, defaultCredsFilename);
  }

  return filepath;
}

export function readCrTokenFile(filepath: string): string {
  if (!existsSync) {
    return '';
  }

  let token: string = '';
  const fileExists = fileExistsAtPath(filepath);
  if (fileExists) {
    token = readFileSync(filepath, 'utf8');
    logger.debug(`Successfully read CR token from file: ${filepath}`);
  }

  if (token === '') {
    if (fileExists) {
      logger.error(`Expected to read CR token from file but the file is empty: ${filepath}`);
    } else {
      logger.error(`Expected to find CR token file but the file does not exist: ${filepath}`);
    }
    throw new Error(`Unable to retrieve the CR token value from file: ${filepath}`);
  }

  return token;
}
