/* Shared browser-game WebMCP transport. No SDK, network or save access. */
(() => {
  'use strict';
  if (globalThis.GameWebMCP) return;
  const games = new Map();

  function validate(schema, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Arguments must be an object.');
    const properties = schema.properties || {};
    for (const key of Object.keys(input)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) throw new Error('Unknown argument: ' + key);
      const rule = properties[key], value = input[key];
      if (rule.type && typeof value !== rule.type) throw new Error('Invalid argument type: ' + key);
      if (rule.enum && !rule.enum.includes(value)) throw new Error('Invalid argument value: ' + key);
      if (typeof value === 'number' && (!Number.isFinite(value) || rule.minimum !== undefined && value < rule.minimum || rule.maximum !== undefined && value > rule.maximum)) throw new Error('Argument outside range: ' + key);
      if (typeof value === 'string' && value.length > (rule.maxLength || 128)) throw new Error('Argument too long: ' + key);
    }
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(input, key)) throw new Error('Missing argument: ' + key);
  }

  function register(config) {
    games.get(config.id)?.dispose();
    const tools = new Map(), registered = [];
    let context, controller, nativeError = null, disposed = false, nativeReady = false;
    let previousFrame = 0, fps = null, raf = 0, samples = [];
    function frame(now) {
      if (disposed) return;
      if (!document.hidden && previousFrame && now - previousFrame < 250) {
        samples.push(now - previousFrame); if (samples.length > 120) samples.shift();
        if (samples.length >= 30) fps = 1000 * samples.length / samples.reduce((a, b) => a + b, 0);
      } else { samples = []; fps = null; }
      previousFrame = now;
      raf = requestAnimationFrame(frame);
    }
    for (const tool of config.tools) {
      if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name) || tools.has(tool.name)) throw new Error('Invalid or duplicate tool name.');
      const schema = tool.inputSchema || {type:'object', properties:{}, additionalProperties:false};
      const execute = async (input = {}, options = {}) => {
        if (disposed) throw new Error('Game tools have been disposed.');
        if (options.signal?.aborted) throw new DOMException('Tool execution cancelled.', 'AbortError');
        validate(schema, input);
        const value = await tool.execute(input, options);
        if (options.signal?.aborted) throw new DOMException('Tool execution cancelled.', 'AbortError');
        return JSON.stringify(value === undefined ? {ok:true} : value);
      };
      tools.set(tool.name, {...tool, inputSchema:schema, execute,
        annotations:{readOnlyHint:!!tool.readOnly, consequentialHint:false, untrustedContentHint:false, debugging:true}});
    }
    async function attach() {
      if (disposed) return;
      nativeReady = false; nativeError = null;
      controller = new AbortController();
      registered.length = 0;
      try {
        // document.modelContext is current; navigator covers earlier previews.
        context = document.modelContext || navigator.modelContext;
        if (!context || typeof context.registerTool !== 'function') return;
        for (const tool of tools.values()) {
          const {readOnly, ...definition} = tool;
          await context.registerTool(definition, {signal:controller.signal});
          registered.push(tool.name);
        }
        nativeReady = true;
      } catch (error) {
        nativeError = error?.name || 'RegistrationError';
        detach();
      }
    }
    function detach() {
      controller?.abort();
      for (const name of registered.splice(0)) {
        try { context?.unregisterTool?.(name); } catch (_) { /* already removed by AbortSignal */ }
      }
      nativeReady = false;
    }
    function hidden() { detach(); }
    function shown(event) { if (event.persisted) void attach(); }
    const api = Object.freeze({
      ready: attach(),
      listTools: () => [...tools.values()].map(({name,description,inputSchema,annotations}) => ({name,description,inputSchema,annotations})),
      execute: (name, input = {}, options = {}) => {
        const tool = tools.get(name);
        if (!tool) return Promise.reject(new Error('Unknown tool: ' + name));
        return tool.execute(input, options);
      },
      diagnostics: () => ({game:config.id,version:config.version,nativeReady,nativeError,
        browserFps:fps === null ? null : Math.round(fps * 10) / 10,
        frameSamples:samples.length,visibility:document.hidden?'hidden':'visible'}),
      dispose: () => {
        if (disposed) return;
        disposed = true; detach(); cancelAnimationFrame(raf);
        window.removeEventListener('pagehide', hidden); window.removeEventListener('pageshow', shown);
        if (games.get(config.id) === api) games.delete(config.id);
      }
    });
    games.set(config.id, api);
    window.addEventListener('pagehide', hidden); window.addEventListener('pageshow', shown);
    raf = requestAnimationFrame(frame);
    return api;
  }
  globalThis.GameWebMCP = Object.freeze({
    register,
    listTools: () => [...games.values()].flatMap(game => game.listTools()),
    execute: (name, input = {}, options = {}) => {
      for (const game of games.values()) if (game.listTools().some(tool => tool.name === name)) return game.execute(name,input,options);
      return Promise.reject(new Error('Unknown tool: ' + name));
    },
    diagnostics: () => [...games.values()].map(game => game.diagnostics())
  });
})();
