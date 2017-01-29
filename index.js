module.exports = (cmd, args = [], opts = {}) => {
  const { platform } = require('os');
  const { join } = require('path');
  const { cwd } = process;
  const crossSpawn = require('cross-spawn-promise')
  const kill = require('tree-kill')

  let cleanup = () => Promise.resolve();

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
        cleanup = () => {
          postCleanup = true;
          if (cp.stdout) {
            cp.stdout.removeListener('data', log);
          }
          if (cp.stderr) {
            cp.stderr.removeListener('data', errLog);
          }
          return new Promise(resolve => {
            kill(cp.pid, 'SIGTERM', () => {
              returnPromise.then(resolve);
            });
          });
        };
        return returnPromise;
      });
    };
  }

  const getter = { get: () => cleanup };
  Object.defineProperty(task, 'cleanup', getter);
  Object.defineProperty(task, 'kill', getter);

  return task;

};
