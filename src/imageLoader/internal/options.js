import {
  writeCacheProxy,
  readCacheProxy,
  getScope,
} from './browserCacheAPIManager.js';

let options = {
  // callback to open the object
  open(xhr, url) {
    xhr.open('get', url, true);
  },
  // callback allowing customization of the xhr (e.g. adding custom auth headers, cors, etc)
  beforeSend(/* xhr, imageId */) {},
  // callback allowing modification of the xhr response before creating image objects
  beforeProcessing(xhr) {
    if (this.writeCache) {
      writeCacheProxy(xhr);
    }

    return Promise.resolve(xhr.response);
  },
  // callback allowing modification of newly created image objects
  imageCreated(/* image */) {},
  strict: false,
  decodeConfig: {
    convertFloatPixelDataToInt: true,
    use16BitDataType: false,
  },
  readCache: true,
  writeCache: false, // only write for prefetch
  cache: {
    getScope,
    readCacheProxy,
    writeCacheProxy,
  },
};

export function setOptions(newOptions) {
  options = Object.assign(options, newOptions);
}

export function getOptions() {
  return options;
}
