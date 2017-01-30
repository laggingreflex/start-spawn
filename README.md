# start-spawn

[![npm](https://img.shields.io/npm/v/start-spawn.svg?style=flat-square)](https://www.npmjs.com/package/start-spawn)

[Start] task to spawn a script/task/command using [cross-spawn]

[start]: https://github.com/start-runner/start
[cross-spawn]: https://github.com/zentrick/cross-spawn-promise

## Install

```sh
npm install --save-dev start-spawn
# or
yarn add --dev start-spawn
```

## Usage

```js
import Start from 'start';
import spawn from 'start-spawn';

const start = Start();

export const dev = () => start(
  spawn('node', ['./server.js']),
  // or
  spawn('node ./index.js', {cwd: 'server'})
  // or
  spawn('babel-node ./server.js')
);
```

It automatically splits arguments and adds `node_modules/.bin` to PATH ([like npm scripts do](https://docs.npmjs.com/misc/scripts#path)).

### Re-usage

If planning to re-use, initialize once and use the same task:

```js
const runTask = spawn('node ./server.js');
export const dev = () => start(
  watch('./server.js')(
    () => start(runTask)
) );
```

This way when the same task is run it automatically kills previously spawned process and cleans up any event listeneres.

It also returns the cleanup function in case you want to do it manually.

```js
const runTask = spawn('node ./server.js');
export const dev = () => start(runTask);

export const someOther = () => start(
  () => {
    runTask.kill();
    //  runTask has been killed and cleaned up
    return start(someOtherTask)
  }
);
```
By default it kills the child process using [tree-kill]\* with a `'SIGTERM'` signal, but you can provide any other signal, or customize the killer function itself:

```js
import treeKill from 'tree-kill';
const killer = (pid, signal, done) => {
  treeKill(pid, signal, done);
}
runTask.kill('SIGTERM', killer); // by argument
// or
runTask.killer = killer; // by configuring
// (in case you just want to alter the function that it'll automatically call)
```
It waits for `done` callback or awaits a returned promise to wait for it to completely exit.

<sup>\*because [child.kill() alone doesn't kill shell-spawned processes][cp.kill]</sup>

[tree-kill]: https://github.com/pkrumins/node-tree-kill
[cp.kill]: https://nodejs.org/api/child_process.html#child_process_child_kill_signal


### Options

Takes same options as spawn, cross-spawn, and cross-spawn-promise.

#### Additional options:

##### `forever` (boolean|number) (default: false)

Restarts if an error occurs, either indefinitely (if `true`) or a set `number` of times.

## Issues

If you have a server app in a watch-spawn cycle but you're still getting `EADDRINUSE` errors, make sure your app closes the server on any kill signals:

```js
const app = new Koa();
//...
process.once('SIGTERM', () => app.server.close());
```
