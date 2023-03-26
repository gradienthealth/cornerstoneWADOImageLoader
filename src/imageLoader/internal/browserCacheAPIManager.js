import external from '../../externalModules.js';

const getScope = ({ url }) => {
  /**
   * getScope takes in a url and returns a string representing a cache
   * scope. For instance, dicom series uid is a scope. This allows the
   * cacheAPI to remove related dicoms with one command.
   */
  const isDicomWeb = url.split('series/');

  if (isDicomWeb.length === 1) {
    return 'default-cornerstone-WADO-cache';
  }
  const scope = `${isDicomWeb[0]}series/${isDicomWeb[1].split('/')[0]}`;

  return scope;
};

const writeCacheProxy = (xhr) => {
  // open cache based on url scoping this allows efficient cache deletion
  // using: window.caches.delete(scope);
  if (!window.caches) {
    return;
  }

  const scope = getScope({ url: xhr.responseURL });
  const cacheLogic = (cache, scope, xhr) => {
    const getXHRJSONHeaders = (xhr) => {
      // Mock headers of response object
      const headers = xhr.getAllResponseHeaders().split('\r\n');

      headers.pop(); // remove empty ""

      return headers.reduce((prev, h) => {
        const [key, value] = h.split(':');

        prev[key] = value.trim();

        return prev;
      }, {});
    };

    const res = new Response(xhr.response, {
      headers: getXHRJSONHeaders(xhr),
    });

    const req = new Request(xhr.responseURL, {
      headers: {
        'dicom-last-put-date': new Date().toUTCString(),
        'dicom-last-viewed-date': 'undefined',
        'dicom-content-length':
          xhr.response instanceof ArrayBuffer
            ? `${xhr.response.byteLength}`
            : 'undefined',
      },
    });
    const triggerQuotaError = () => {
      const error = new DOMError('QuotaExceededError');

      external.cornerstone.triggerEvent(
        external.cornerstone.events,
        'CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR',
        {
          error,
          xhr,
          scope,
          cache,
          retry: () => cacheLogic(cache, scope, xhr),
        }
      );

      return error;
    };

    return cache.put(req, res).catch((error) => {
      if (error.name === 'QuotaExceededError') {
        triggerQuotaError();
      } else {
        console.error(error);
      }
    });
  };

  window.caches.open(scope).then((cache) => {
    cacheLogic(cache, scope, xhr);
  });
};

const readCacheProxy = async (xhr, url, resolve) => {
  // open cache based on url scoping this allows efficient cache deletion
  // using: window.caches.delete(scope);
  const scope = getScope({ url });

  if (!window.caches) {
    return false;
  }

  try {
    const cache = await window.caches.open(scope);
    const res = await cache.match(url, {
      ignoreVary: true,
      ignoreMethod: true,
      ignoreSearch: true,
    });

    if (!res) {
      return false;
    }

    const resClone = res.clone();

    xhr.getResponseHeader = (name) => res.headers.get(name);
    const arrayBuffer = res.arrayBuffer();
    const contentLength = arrayBuffer.byteLength;

    resolve(arrayBuffer);

    const req = new Request(url, {
      headers: {
        'dicom-last-put-date': new Date().toUTCString(),
        'dicom-last-viewed-date': new Date().toUTCString(),
        'dicom-content-length': `${contentLength}`,
      },
    });

    cache.put(req, resClone);

    return true;
  } catch (e) {
    console.error(e);

    return false;
  }
};

export { writeCacheProxy, readCacheProxy, getScope };

/**
 * Handling a cache overflow
 *
 * Today cache overflows are default silent. However, we fire the following events in the case
 * of a cache overflow:
 *
 * CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR
 * CORNERSTONE_DUMMY_QUOTA_EXCEEDED_ERROR
 * CORNERSTONE_LOCALFORAGE_WRITE_FAILURE
 *
 * Localforage is used to keep track of an index of cache size + last access time
 * Localforage contains a 5MB dummy which is deleted in the case there is no space left on device, this allows
 * for proper syncing. If localforage fails to write a CORNERSTONE_LOCALFORAGE_WRITE_FAILURE is triggered.
 *
 * In the future, it may be easier to store a list of images which have been "user accessed". Regardless of size.
 * This would serve as the shortlist of cache keys to be deleted.
 *
 * This means we need to trigger the xhrRequest function with a "background" and "foreground" mode.
 * The background mode means the downloads are simply storing network calls and user is not viewing them
 * foreground is the default behaviour.
 *
 */
