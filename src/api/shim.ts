// Shim setTimeout/setInterval to support Node-specific .unref()/.ref() methods inside V8 isolates (Cloudflare Workers)
const shimTimer = (original: any) => {
  return function (cb: any, ms: any, ...args: any[]) {
    const timer = original(cb, ms, ...args);
    if (timer && typeof timer === "object" && !("unref" in timer)) {
      (timer as any).unref = () => timer;
      (timer as any).ref = () => timer;
    }
    return timer;
  };
};

if (typeof globalThis !== "undefined") {
  globalThis.setTimeout = shimTimer(globalThis.setTimeout) as any;
  globalThis.setInterval = shimTimer(globalThis.setInterval) as any;
}
