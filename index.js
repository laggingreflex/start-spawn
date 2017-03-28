const defaultKillSig = 'SIGTERM';

module.exports = (cmd, args, opts) => {
  const { platform } = require('os');
  const { join } = require('path');
  const { cwd } = process;
  const crossSpawn = require('cross-spawn-promise')
  const defaultKiller = require('tree-kill');

  let cleanup = () => Promise.resolve();

  let configurableKiller;
  let configurableKillSig;

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
      return cleanup().then(function restart(count = 0) {
        addNodeBinPath();
        const cmdStr = '(' + cmd + ' ' + args.join(' ') + ')';
        if (count) {
          if (typeof opts.forever === 'number' && opts.forever >= count) {
            throw new Error(`Couldn't restart ` + cmdStr + ` Maximum retries exceeded (${opts.forever}>=${count})`);
          } else {
            log(`Restarting (${count}) ` + cmdStr);
          }
        } else {
          log('Starting ' + cmdStr);
        }
        const cpPromise = crossSpawn(cmd, args, opts);
        const cp = cpPromise.childProcess;
        const pidStr = `[PID:${cp.pid}]`;
        const pidMsgStr = pidStr + cmdStr;
        log('Started ' + pidMsgStr);
        const stdout = msg => log(pidStr + ' ' + msg);
        if (cp.stdout) {
          cp.stdout.on('data', stdout);
        }
        const stderr = msg => log(pidStr + ' ' + msg);
        if (cp.stderr) {
          cp.stderr.on('data', stderr);
        }
        const removeListeners = () => {
          if (cp.stdout) {
            try {
              cp.stdout.removeListener('data', stdout);
            } catch (noop) {}
          }
          if (cp.stderr) {
            try {
              cp.stderr.removeListener('data', stderr);
            } catch (noop) {}
          }
        };
        let postCleanup = false;
        const returnPromise = cpPromise.then(() => {
          log('Exited ' + pidMsgStr);
          if (opts.forever) {
            return restart(++count);
          }
        }).catch(err => {
          if (postCleanup) {
            return;
          } else {
            err.message = 'Exited with error ' + pidMsgStr + ' ' + err.message;
            if (opts.forever) {
              log(err.message);
              return restart(++count);
            } else {
              throw err;
            }
          }
        }).then(removeListeners);
        cleanup = (argKillSig, argKiller) => {
          postCleanup = true;
          return new Promise((resolve, reject) => {
            let killPromise;
            const killer = argKiller || configurableKiller || defaultKiller;
            const killSig = argKillSig || configurableKillSig || defaultKillSig;
            const errMsg = `Couldn't kill ` + pidMsgStr;
            const sucMsg = 'Killed  ' + pidMsgStr;
            const cb = (err) => {
              if (err) {
                log(errMsg + ' ' + err.message);
              } else {
                log(sucMsg);
              }
              return returnPromise.then(() => {
                resolve();
                removeListeners();
              });
            }
            try {
              // log('Killing ' + pidMsgStr);
              killPromise = killer(cp.pid, killSig, cb);
            } catch (err) {
              log(errMsg + ' ' + err.message);
              resolve();
              removeListeners();
              return;
            }
            if (killPromise && killPromise.then) {
              killPromise.then(() => returnPromise).then(() => {
                log(sucMsg);
              }).catch(err => {
                log(errMsg + ' ' + err.message);
              }).then(() => {
                resolve();
                removeListeners();
              });
            } else if (killer && killer.length < 3) {
              log(sucMsg);
              resolve();
              removeListeners();
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
  Object.defineProperty(task, 'killSig', { set: (sig) => configurableKillSig = sig });

  return task;

};
