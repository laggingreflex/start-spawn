module.exports = (cmd, args = [], opts = {}) => {
  const { platform } = require('os');
  const { join } = require('path');
  const { cwd } = process;
  const crossSpawn = require('cross-spawn-promise')

  let cleanup = () => Promise.resolve();

  let configurableKiller;

  const task = (input) => {

    if (!cmd || typeof cmd !== 'string') {
      throw new Error('Need a command as string');
    }

    if (!opts && args && !Array.isArray(args)) {
      opts = args;
      args = [];
    }

    if (cmd.indexOf(' ') > 0 && !args.length) {
      [cmd, ...args] = cmd.split(/ +/g);
    }

    if (!opts.env || !opts.env.PATH) {
      opts.env = opts.env || Object.assign({}, process.env);
      opts.env.PATH = opts.env.PATH || process.env.PATH || '';
      opts.env.PATH = join(cwd(), 'node_modules', '.bin') + (platform() === 'win32' ? ';' : ':') + opts.env.PATH;
    }

    Object.assign(opts, {
      shell: true,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    return function spawn(log, reporter) {

      return cleanup().then(() => {
        const cpPromise = crossSpawn(cmd, args, opts);
        const cp = cpPromise.childProcess;
        if (cp.stdout) {
          cp.stdout.on('data', log);
        }
        const errLog = msg => log('error', msg);
        if (cp.stderr) {
          cp.stderr.on('data', errLog);
        }
        let postCleanup = false;
        const returnPromise = cpPromise.catch(err => {
          if (postCleanup) {
            return;
          } else {
            throw err;
          }
        });
        const defaultKiller = (pid, sig) => cp.kill(sig);
        cleanup = (KILL_SIGNAL = 'SIGTERM', argKiller) => {
          postCleanup = true;
          if (cp.stdout) {
            cp.stdout.removeListener('data', log);
          }
          if (cp.stderr) {
            cp.stderr.removeListener('data', errLog);
          }
          return new Promise((resolve, reject) => {
            const cb = (err) => err ? reject(err) : returnPromise.then(resolve);
            let killPromise;
            const killer = argKiller || configurableKiller || defaultKiller;
            try {
              killPromise = killer(cp.pid, KILL_SIGNAL, cb);
            } catch (err) {
              return reject(err);
            }
            if (killPromise && killPromise.then) {
              killPromise.then(() => returnPromise).then(resolve).catch(reject);
            } else if (!killer.length || killer.length < 3) {
              resolve();
            }
          });
        };
        return returnPromise;
      });
    };
  }

  const cleanupGetter = { get: () => cleanup };
  Object.defineProperty(task, 'cleanup', cleanupGetter);
  Object.defineProperty(task, 'kill', cleanupGetter);

  Object.defineProperty(task, 'killer', { set: (killer) => configurableKiller = killer });

  return task;

};
