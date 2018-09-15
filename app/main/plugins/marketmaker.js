import childProcess from 'child_process';
import ipc from 'electron-better-ipc';
import { app } from 'electron';
import killProcess from './killprocess';
import config from '../config';

// const { marketmakerCrashedDialog } = require('../dialogs');
const debug = require('debug')('dicoapp:plugins:marketmaker');

const MarketMaker = () => {
  const state = {
    isRunning: false
  };

  let marketmakerProcess = null;

  return Object.assign({
    start: function start(options) {
      debug('start');
      // killProcess('marketmaker');
      this.stop();

      const coins = config.get('marketmaker.data');
      const startparams = Object.assign({}, options, {
        client: 1,
        canbind: 0,
        gui: 'dICOapp-cm',
        passphrase: 'default',
        userhome: config.get('paths.homeDir'),
        coins
      });

      marketmakerProcess = childProcess.spawn(
        config.get('paths.marketmaker'),
        [JSON.stringify(startparams)],
        { cwd: config.get('paths.userDataDir') }
      );

      state.isRunning = true;

      // The 'error' event is emitted whenever:
      //  The process could not be spawned, or
      //   The process could not be killed, or
      //  Sending a message to the child process failed.
      marketmakerProcess.on('error', error => {
        debug(error.message);
        state.isRunning = false;
        throw error;
      });

      // The 'exit' event is emitted after the child process ends.
      // marketmakerProcess.on('exit', () => {
      //   if (!this.isRunning) {
      //     return;
      //   }

      //   state.isRunning = false;
      //   marketmakerCrashedDialog();
      // });

      app.on('quit', () => {
        this.stop();
      });
    },

    stop: function stop() {
      debug('stop');
      state.isRunning = false;
      if (marketmakerProcess) {
        marketmakerProcess.kill();
      }

      marketmakerProcess = null;
      killProcess('marketmaker');
    },

    isRunning: function isRunning() {
      return state.isRunning;
    }
  });
};

let marketmaker = null;

function setup() {
  if (marketmaker) return marketmaker;

  marketmaker = MarketMaker();

  ipc.answerRenderer('marketmaker:start', () => marketmaker.start());

  ipc.answerRenderer('marketmaker:stop', () => marketmaker.stop());

  ipc.answerRenderer('marketmaker:restart', async () => marketmaker.start());

  return marketmaker;
}

export default setup();
