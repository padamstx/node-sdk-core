/**
 * (C) Copyright IBM Corp. 2014, 2021.
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

import { isReadable } from 'isstream';
import { lookup } from 'mime-types';
import { basename } from 'path';
import logger from './logger';

const FileType = require('file-type');

export interface FileObject {
  value: NodeJS.ReadableStream | Buffer | string;
  options?: FileOptions;
}

// internal interfaces
export interface FileOptions {
  filename?: string;
  contentType?: string;
}

export interface FileWithMetadata {
  data: NodeJS.ReadableStream | Buffer;
  filename: string;
  contentType: string;
}

export interface FileStream extends NodeJS.ReadableStream {
  path: string | Buffer;
}

// custom type guards
function isFileObject(obj: any): obj is FileObject {
  return Boolean(obj && obj.value);
}

function isFileStream(obj: any): obj is FileStream {
  return Boolean(obj && isReadable(obj) && obj.path);
}

export function isFileWithMetadata(obj: any): obj is FileWithMetadata {
  return Boolean(obj && obj.data && isFileData(obj.data));
}

export function isFileData(obj: any): obj is NodeJS.ReadableStream | Buffer {
  return Boolean(obj && (isReadable(obj) || Buffer.isBuffer(obj)));
}

export function isEmptyObject(obj: any): boolean {
  return Boolean(obj && Object.keys(obj).length === 0 && obj.constructor === Object);
}

/**
 * This function retrieves the content type of the input.
 * @param {NodeJS.ReadableStream|Buffer} inputData - The data to retrieve content type for.
 * @returns {string} the content type of the input.
 */
export async function getContentType(inputData: NodeJS.ReadableStream | Buffer): Promise<string> {
  let contentType = null;
  if (isFileStream(inputData)) {
    // if the inputData is a NodeJS.ReadableStream
    const mimeType = lookup(inputData.path as any); // TODO: cleue quick hack, per type definition path could also be a Buffer
    contentType = { mime: mimeType || null };
  } else if (Buffer.isBuffer(inputData)) {
    // if the inputData is a Buffer
    contentType = await FileType.fromBuffer(inputData);
  }

  return contentType ? contentType.mime : null;
}

/**
 *
 * @param {string} url - the url string.
 * @returns {string}
 */
export function stripTrailingSlash(url: string): string {
  // Match a forward slash / at the end of the string ($)
  return url.replace(/\/$/, '');
}

/**
 * Return a query parameter value from a URL
 *
 * @param {string} urlStr - the url string.
 * @param {string} param - the name of the query parameter
 *                     whose value should be returned
 * @returns {string} the value of the `param` query parameter
 * @throws if urlStr is an invalid URL
 */
export function getQueryParam(urlStr: string, param: string): string {
  // The base URL is a dummy value just so we can process relative URLs
  const url = new URL(urlStr, 'https://foo.bar');
  return url.searchParams.get(param);
}

/**
 * Validates that all required params are provided
 * @param params - the method parameters.
 * @param requires - the required parameter names.
 * @returns {Error|null}
 */
export function getMissingParams(params: { [key: string]: any }, requires: string[]): null | Error {
  let missing;
  if (!requires) {
    return null;
  } else if (!params) {
    missing = requires;
  } else {
    missing = [];
    requires.forEach((require) => {
      if (isMissing(params[require])) {
        missing.push(require);
      }
    });
  }
  return missing.length > 0
    ? new Error(`Missing required parameters: ${missing.join(', ')}`)
    : null;
}

/**
 * Validates that "params" contains a value for each key listed in "requiredParams",
 * and that each key contained in "params" is a valid key listed in "allParams".
 * In essence, we want params to contain only valid keys and we want params
 * to contain at least the required keys.
 *
 * @param params - the "params" object passed into an operation containing method parameters.
 * @param requiredParams - the names of required parameters.
 * If null, then the "required params" check is bypassed.
 * @param allParams - the names of all valid parameters.
 * If null, then the "valid params" check is bypassed.
 * @returns {Error|null}
 */
export function validateParams(
  params: { [key: string]: any },
  requiredParams: string[],
  allParams: string[]
): null | Error {
  let missing = [];
  const invalid = [];

  // If there are any required fields, then make sure they are present in "params".
  if (requiredParams) {
    if (!params) {
      missing = requiredParams;
    } else {
      requiredParams.forEach((require) => {
        if (isMissing(params[require])) {
          missing.push(require);
        }
      });
    }
  }

  // Make sure that each field specified in "params" is a valid param.
  if (allParams && params) {
    Object.keys(params).forEach((key) => {
      if (!allParams.includes(key)) {
        invalid.push(key);
      }
    });
  }

  // If no errors found, then bail now.
  if (missing.length === 0 && invalid.length === 0) {
    return null;
  }

  // Return an Error object identifying the errors we found.
  let errorMsg = 'Parameter validation errors:';
  if (missing.length > 0) {
    errorMsg += `\n  Missing required parameters: ${missing.join(', ')}`;
  }
  if (invalid.length > 0) {
    errorMsg += `\n  Found invalid parameters: ${invalid.join(', ')}`;
  }

  return new Error(errorMsg);
}

/**
 * Returns true if value is determined to be "missing". Currently defining "missing"
 * as `undefined`, `null`, or the empty string.
 *
 * @param value - the parameter value
 * @returns boolean
 */
function isMissing(value: any): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Return true if 'text' is html
 * @param  {string} text - The 'text' to analyze
 * @returns {boolean} true if 'text' has html tags
 */
export function isHTML(text: string): boolean {
  logger.debug(`Determining if the text ${text} is HTML.`);
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Returns the first match from formats that is key the params map
 * otherwise null
 * @param  {Object} params - The parameters.
 * @param  {string[]} requires - The keys we want to check
 * @returns {string|null}
 */
export function getFormat(params: { [key: string]: any }, formats: string[]): string {
  if (!formats || !params) {
    logger.debug(`No formats to parse in getFormat. Returning null`);
    return null;
  }
  const validFormats = formats.filter((item) => item in params);
  if (validFormats.length) return validFormats[0];

  logger.debug(`No formats to parse in getFormat. Returning null`);
  return null;
}

/**
 * This function builds a `form-data` object for each file parameter.
 * @param {FileWithMetadata} fileParam The file parameter.
 * @param {NodeJS.ReadableStream|Buffer} fileParam.data The data content of the file.
 * @param {string} fileParam.filename The filename of the file.
 * @param {string} fileParam.contentType The content type of the file.
 * @returns {FileObject}
 */
export async function buildRequestFileObject(fileParam: FileWithMetadata): Promise<FileObject> {
  let fileObj: FileObject;
  if (isFileObject(fileParam.data)) {
    // For backward compatibility, we allow the data to be a FileObject.
    fileObj = { value: fileParam.data.value, options: {} };
    if (fileParam.data.options) {
      fileObj.options = {
        filename: fileParam.filename || fileParam.data.options.filename,
        contentType: fileParam.contentType || fileParam.data.options.contentType,
      };
    }
  } else {
    fileObj = {
      value: fileParam.data,
      options: {
        filename: fileParam.filename,
        contentType: fileParam.contentType,
      },
    };
  }

  // Also for backward compatibility, we allow data to be a string
  if (typeof fileObj.value === 'string') {
    fileObj.value = Buffer.from(fileObj.value);
  }

  // build filename
  // eslint-disable-next-line prefer-destructuring
  let filename: string | Buffer = fileObj.options.filename;
  if (!filename && isFileStream(fileObj.value)) {
    // if readable stream with path property
    filename = fileObj.value.path;
  }
  // toString handles the case when path is a buffer
  fileObj.options.filename = filename ? basename(filename.toString()) : '_';

  // build contentType
  if (!fileObj.options.contentType && isFileData(fileObj.value)) {
    fileObj.options.contentType =
      (await getContentType(fileObj.value)) || 'application/octet-stream';
  }

  return fileObj;
}

/**
 * This function converts an object's keys to lower case.
 * note: does not convert nested keys
 * @param {Object} obj The object to convert the keys of.
 * @returns {Object}
 */
export function toLowerKeys(obj: Object): Object {
  let lowerCaseObj = {};
  if (obj) {
    lowerCaseObj = Object.assign(
      {},
      ...Object.keys(obj).map((key) => ({
        [key.toLowerCase()]: obj[key],
      }))
    );
  }
  return lowerCaseObj;
}

/**
 * Constructs a service URL by formatting a parameterized URL.
 *
 * @param {string} parameterizedUrl URL that contains variable placeholders, e.g. '{scheme}://ibm.com'.
 * @param {Map<string, string>} defaultUrlVariables Map from variable names to default values.
 *  Each variable in the parameterized URL must have a default value specified in this map.
 * @param {Map<string, string>} providedUrlVariables Map from variable names to desired values.
 *  If a variable is not provided in this map,
 *  the default variable value will be used instead.
 * @returns {string} The formatted URL with all variable placeholders replaced by values.
 */
export function constructServiceUrl(
  parameterizedUrl: string,
  defaultUrlVariables: Map<string, string>,
  providedUrlVariables: Map<string, string> | null
): string {
  // If null was passed, we set the variables to an empty map.
  // This results in all default variable values being used.
  if (providedUrlVariables === null) {
    providedUrlVariables = new Map<string, string>();
  }

  // Verify the provided variable names.
  providedUrlVariables.forEach((_, name) => {
    if (!defaultUrlVariables.has(name)) {
      throw new Error(`'${name}' is an invalid variable name.
      Valid variable names: [${Array.from(defaultUrlVariables.keys()).sort()}].`);
    }
  });

  // Format the URL with provided or default variable values.
  let formattedUrl = parameterizedUrl;

  defaultUrlVariables.forEach((defaultValue, name) => {
    // Use the default variable value if none was provided.
    const providedValue = providedUrlVariables.get(name);
    const formatValue = providedValue !== undefined ? providedValue : defaultValue;

    formattedUrl = formattedUrl.replace(`{${name}}`, formatValue);
  });

  return formattedUrl;
}
