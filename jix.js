"use strict";

/**
 * TODO:
 *  - parsing function definitions,
 *  - our own tests
 *  - yield fixtures
 *  - module scoped fixtures
 */


function debug(msg) {
  console.log(msg);
}


// http://stackoverflow.com/a/10284006/15677
function zip(arrays) {
    return arrays[0].map(function(_,i){
        return arrays.map(function(array){return array[i]})
    });
}


/**
 * Registry of all fixtures.
 */
class FixtureRegistry {
  constructor() {
    this._fixtures = {};
  }
  addFixture(name, fixtureFunc) {
    if (fixtureFunc === undefined) {
      fixtureFunc = name;
      name =  null;
    }

    if (!name)
      name = fixtureFunc.name;

    if (!name) {
      throw "fixture has no name."
    }

    this._fixtures[name] = fixtureFunc;
  }
  get fixtures() {
    return this._fixtures;
  }
}


/**
 * An object that has a getter property for every fixture in
 * ``registry``. The first time the property is accessed, the
 * fixture function is called. Subsequently, the getter always
 * returns the same value.
 *
 * If a fixture defines a finalizer, it will be added to
 * ``teardownCollector``.
 *
 * Can be used with destructering:
 *
 *     {app, db} = fixtures;
 */
function FixtureResolver(registry, teardownCollector, getRequest) {
  let cachedValues = {};

  // For every fixture in the registry, define a getter property.
  // That getter will call the fixture function the first time
  // it is used, and later return the cached value.
  for (let name in registry.fixtures) {
    debug('registerFixture', name);

    const fixtureFunc = registry.fixtures[name];

    const setupFixture = (name) => {
      if (cachedValues[name]) {
        debug(`setupFixture: ${name} from cache`);
        return cachedValues[name];
      }

      debug(`setupFixture: ${name}`);
      let request = Object.assign({}, getRequest());
      request.addFinalizer = function(callback) {
        teardownCollector.add(name, callback);
      }

      cachedValues[name] = fixtureFunc(request);
      return cachedValues[name];
    }

    Object.defineProperty(
      this, name,
      {
        get: () => setupFixture(name)
      });
  }
}


/**
 * Collect fixture teardown functions, ability to run all of them
 * in the right order.
 */
class TeardownCollector {
  constructor() {
    this._teardownHandlers = [];
  }

  add(fixtureName, func) {
    this._teardownHandlers.push({fixtureName, func});
  }

  teardown() {
    var exceptionsDuringTeardown = [];

    this._teardownHandlers.forEach(({fixtureName, func}) => {
      try {
        debug(`teardown func for ${fixtureName}`);
        func();
      }
      catch (e) {
        exceptionsDuringTeardown.push(e);
      }
    });

    exceptionsDuringTeardown.forEach(e => {
      console.log('EXCEPTION DURING TEARDOWN:')
      console.log('**************************')
      console.log(e);
    })
  }
}



function makeTestRunnerFunc(registry) {
  return function decorator(func) {
    return function runTestFunc() {
      let request = {};
      const teardown = new TeardownCollector();
      const resolver = new FixtureResolver(
        registry, teardown, () => request);

      request.fixtures = resolver;
      request.get = function() {
        const promises =
          Array.from(arguments)
            .map(name => Promise.resolve(resolver[name]));
        return Promise.all(promises).then(results => {
          let resultObj = {};
          results.forEach((result, idx) => {
            resultObj[arguments[idx]] = result;
          });
          return resultObj;
        });
      }

      try {
        let args = [request].concat(Array.from(arguments));
        return func.apply(null, args);
      }
      finally {
        teardown.teardown();
      }
    }
  }
}



// Provide a global registry object by default
const DefaultRegistry = new FixtureRegistry();
const f = DefaultRegistry.addFixture.bind(DefaultRegistry);
const t = makeTestRunnerFunc(DefaultRegistry);
export {f, t};
