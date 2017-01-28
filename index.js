module.exports = (cmd, args = [], opts = {}) => {

  let cleanup = () => {};

  const task = (input) => {

    cleanup();

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

    return function run(log, reporter) {
      const { platform } = require('os');
      const { join } = require('path');
      const { cwd } = process;
      const spawn = require('cross-spawn-promise')

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

      const cpPromise = spawn(cmd, args, opts);
      const cp = cpPromise.childProcess;
      if (cp.stdout) {
        cp.stdout.on('data', log);
      }
      const errLog = msg => log('error', msg);
      if (cp.stderr) {
        cp.stderr.on('data', errLog);
      }
      let postCleanup = false;
      cleanup = () => {
        postCleanup = true;
        if (cp.stdout) {
          cp.stdout.removeListener('data', log);
        }
        if (cp.stderr) {
          cp.stderr.removeListener('data', errLog);
        }
        try { cp.kill('SIGHUP') } catch (err) {}
        try { cp.kill('SIGTERM') } catch (err) {}
        try { cp.kill('SIGINT') } catch (err) {}
      };
      return cpPromise.catch(err => {
        if (postCleanup) {
          return;
        } else {
          throw err;
        }
      });
    };
  }

  const getter = { get: () => cleanup };
  Object.defineProperty(task, 'cleanup', getter);
  Object.defineProperty(task, 'kill', getter);

  return task;

};
