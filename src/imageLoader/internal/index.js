import { setOptions, getOptions } from './options.js';
import { default as xhrRequest } from './xhrRequest.js';

const internal = {
  xhrRequest,
  setOptions,
  getOptions,
};

export { setOptions, getOptions, xhrRequest, internal };
