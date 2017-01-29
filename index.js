module.exports = (cmd, args, opts) => {
  const { platform } = require('os');
  const { join } = require('path');
  const { cwd } = process;
  const crossSpawn = require('cross-spawn-promise')

  let cleanup = () => Promise.resolve();

  let configurableKiller;

  let nodeBinpathAdded = false;
  const addNodeBinPath = () => {
    if (nodeBinpathAdded) return;
    nodeBinpathAdded = true;
    if (opts.env && opts.env.PATH) return;
    opts.env = opts.env || Object.assign({}, process.env);
    opts.env.PATH = opts.env.PATH || process.env.PATH || '';
    opts.env.PATH = join(cwd(), 'node_modules', '.bin') + (platform() === 'win32' ? ';' : ':') + opts.env.PATH;
  }

  const task = (input) => {

    if (!cmd || typeof cmd !== 'string') {
      throw new Error('Need a command as string');
    }

    if (!opts && args && !Array.isArray(args)) {
      opts = args;
      args = [];
    }

    if (!args) {
      args = [];
    }
    if (!opts) {
      opts = {};
    }

    if (cmd.indexOf(' ') > 0 && !args.length) {
      [cmd, ...args] = cmd.split(/ +/g);
    }

    Object.assign(opts, {
      shell: true,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    return function spawn(log, reporter) {
      return cleanup().then(() => {
        addNodeBinPath();
        const cmdStr = '(' + cmd + ' ' + args.join(' ') + ')';
        log('Starting ' + cmdStr);
        const cpPromise = crossSpawn(cmd, args, opts);
        const cp = cpPromise.childProcess;
        const pidStr = `[PID:${cp.pid}]`;
        const pidMsgStr = pidStr + cmdStr;
        log('Started ' + pidMsgStr);
        const stdout = msg => log(pidStr + ' ' + msg);
        if (cp.stdout) {
          cp.stdout.on('data', stdout);
        }
        const stderr = msg => log('error', pidStr + ' ' + msg);
        if (cp.stderr) {
          cp.stderr.on('data', stderr);
        }
        let postCleanup = false;
        const returnPromise = cpPromise.then(() => {
          log('Exited ' + pidMsgStr);
        }).catch(err => {
          if (postCleanup) {
            return;
          } else {
            err.message = 'Exited with error ' + pidMsgStr + ' ' + err.message;
            throw err;
          }
        });
        const defaultKiller = (pid, sig) => cp.kill(sig);
        cleanup = (KILL_SIGNAL = 'SIGTERM', argKiller) => {
          postCleanup = true;
          if (cp.stdout) {
            cp.stdout.removeListener('data', stdout);
          }
          if (cp.stderr) {
            cp.stderr.removeListener('data', stderr);
          }
          return new Promise((resolve, reject) => {
            const cb = (err) => err ? reject(err) : returnPromise.then(resolve);
            let killPromise;
            const killer = argKiller || configurableKiller || defaultKiller;
            const errMsg = `Couldn't kill ` + pidMsgStr;
            const sucMsg = 'Killed  ' + pidMsgStr;
            try {
              log('Killing ' + pidMsgStr + '...');
              killPromise = killer(cp.pid, KILL_SIGNAL, cb);
            } catch (err) {
              err.message = errMsg + ' ' + err.message;
              return reject(err);
            }
            if (killPromise && killPromise.then) {
              killPromise.then(() => returnPromise).then(() => {
                log(sucMsg);
                resolve();
              }).catch(err => {
                err.message = errMsg + ' ' + err.message
                reject(err);
              });
            } else if (!killer.length || killer.length < 3) {
              log(sucMsg);
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
