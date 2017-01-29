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

This way when the same task is run it automatically kills previously spawned process and cleans up any event listeneres. It also returns the cleanup function in case you want to do it manually.

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